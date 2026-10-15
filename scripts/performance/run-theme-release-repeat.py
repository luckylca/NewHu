#!/usr/bin/env python3
"""Repeatable ThemeSet Release run with route lifecycle, gestures, and Perfetto evidence."""
from __future__ import annotations
import csv, hashlib, json, os, pathlib, re, subprocess, sys, time, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = pathlib.Path(os.environ.get("NEWHU_PERF_OUTPUT", str(ROOT / ".perf-runs" / "themeSet-native"))).expanduser()
DEVICE = os.environ.get("DEVICE_ID", "9ea3b4d2")
APP = "com.anonymous.NewHu"
ADB = [os.environ.get("ADB", "adb"), "-s", DEVICE]
TP = pathlib.Path(os.environ.get("TRACE_PROCESSOR", str(pathlib.Path.home() / ".local/share/perfetto/prebuilts/trace_processor_shell-d29864d1ba3b3685"))).expanduser()
SOURCES = [
    "app/themeSet.tsx",
    "project/react-native-liquid-glass/android-core/src/main/java/com/newhu/liquidglass/backdrop/GlassBackdropCoordinator.kt",
    "project/react-native-liquid-glass/android-core/src/main/java/com/newhu/liquidglass/backdrop/BackdropRecorder.kt",
    "project/react-native-liquid-glass/android/src/main/java/expo/modules/newhuliquidglass/ExpoGlassProviderCoreView.kt",
    "project/react-native-liquid-glass/android/src/main/java/expo/modules/newhuliquidglass/ExpoGlassSurfaceCoreView.kt",
    "project/react-native-liquid-glass/android-core/src/main/java/com/newhu/liquidglass/telemetry/LiquidGlassTrace.kt",
    "project/react-native-hyper-ui/src/components/TopAppBar.tsx",
    "project/react-native-hyper-ui/src/components/PageScaffold.tsx",
    "project/react-native-hyper-ui/src/components/pages/StaticSettingsPage.tsx",
]


def cmd(args, *, capture=False, stdin=None, stdout=None, stderr=None, timeout=30):
    return subprocess.run(args, check=True, text=capture, capture_output=capture,
                          stdin=stdin, stdout=stdout, stderr=stderr, timeout=timeout).stdout if capture else None


def adb(args, *, capture=False, stdin=None, stdout=None, stderr=None, timeout=30):
    return cmd(ADB + args, capture=capture, stdin=stdin, stdout=stdout, stderr=stderr, timeout=timeout)


def shell(*args):
    return adb(["shell", *args], capture=True).strip()


def uptime_s():
    return float(shell("cat", "/proc/uptime").split()[0])


def process_pid():
    result = subprocess.run(ADB + ["shell", "pidof", APP], check=False, text=True, capture_output=True, timeout=15)
    return result.stdout.strip() if result.returncode == 0 else ""


def screenshot(path):
    pathlib.Path(path).write_bytes(subprocess.run(ADB + ["exec-out", "screencap", "-p"], check=True, capture_output=True, timeout=20).stdout)


def dump_ui(label, out):
    remote = f"/sdcard/newhu-themeSet-{label}.xml"
    shell("uiautomator", "dump", remote)
    raw = subprocess.run(ADB + ["exec-out", "cat", remote], check=True, capture_output=True, timeout=20).stdout.decode("utf-8", "replace")
    (out / f"ui-{label}.xml").write_text(raw)
    return ET.fromstring(raw)


def node_text(n):
    return (n.attrib.get("text", "") + " " + n.attrib.get("content-desc", "")).strip()


def center(node):
    vals = list(map(int, node.attrib["bounds"].replace("][", ",").strip("[]").split(",")))
    return (vals[0] + vals[2]) // 2, (vals[1] + vals[3]) // 2


def tap_node(node, label, out):
    x, y = center(node)
    (out / f"{label}-bounds.txt").write_text(f"bounds={node.attrib.get('bounds')} center={x},{y}\n")
    shell("input", "tap", str(x), str(y))
    time.sleep(0.7)


def wait_for(label, predicate, out, timeout=28):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        root = dump_ui(label, out)
        if predicate(list(root.iter("node"))):
            return root
        time.sleep(0.25)
    raise RuntimeError(f"Timed out waiting for {label}")


def is_theme(nodes):
    return any("主题设置" in node_text(n) for n in nodes)


def theme_row(nodes):
    return next((n for n in nodes if n.attrib.get("clickable") == "true"
                 and "主题与壁纸" in node_text(n) and "颜色、壁纸" in node_text(n)), None)


def settings_row(nodes):
    return next((n for n in nodes if n.attrib.get("clickable") == "true"
                 and "管理账号、主题与应用偏好" in node_text(n)), None)


def enter_theme_from_launcher(out):
    root = wait_for("launcher-start", lambda ns: any(n.attrib.get("package") == APP for n in ns), out, 28)
    deadline = time.monotonic() + 24
    profile = settings_row(list(root.iter("node")))
    while profile is None and time.monotonic() < deadline:
        if any("搜索知乎内容" in node_text(n) for n in root.iter("node")):
            shell("input", "tap", "895", "3105")
            time.sleep(0.9)
        root = dump_ui("profile", out)
        profile = settings_row(list(root.iter("node")))
        if profile is None:
            time.sleep(0.3)
    if profile is None:
        raise RuntimeError("Profile/Settings row not found after app launch")
    tap_node(profile, "settings-row", out)
    root = wait_for("settings-page", lambda ns: theme_row(ns) is not None, out, 24)
    tap_node(theme_row(list(root.iter("node"))), "theme-row", out)
    root = wait_for("theme-ready", is_theme, out, 24)
    (out / "theme-ready-marker.txt").write_text("ThemeSet title present\n")
    return root


def enter_theme_warm(out):
    root = dump_ui("warm-start", out)
    if is_theme(list(root.iter("node"))):
        shell("input", "keyevent", "KEYCODE_BACK")
        time.sleep(0.7)
        root = wait_for("warm-settings", lambda ns: theme_row(ns) is not None, out, 15)
    row = theme_row(list(root.iter("node")))
    if row is None:
        raise RuntimeError("Warm reentry did not begin at ThemeSet or Settings")
    tap_node(row, "warm-theme-row", out)
    return wait_for("theme-ready", is_theme, out, 20)


def remove_from_recents(out):
    shell("input", "keyevent", "KEYCODE_APP_SWITCH")
    time.sleep(0.8)
    root = dump_ui("recents-before-dismiss", out)
    card = next((n for n in root.iter("node") if n.attrib.get("clickable") == "true"
                 and node_text(n).startswith("NewHu,")), None)
    if card is None:
        raise RuntimeError("NewHu task card not found in Android Recents")
    vals = list(map(int, card.attrib["bounds"].replace("][", ",").strip("[]").split(",")))
    x = max(vals[0] + 20, min(vals[2] - 20, (vals[0] + vals[2]) // 2))
    y0 = max(vals[1] + 250, min(vals[3] - 250, (vals[1] + vals[3]) // 2 + 400))
    shell("input", "swipe", str(x), str(y0), str(x), str(max(vals[1] + 80, 500)), "300")
    time.sleep(0.8)
    after = dump_ui("recents-after-dismiss", out)
    if any(node_text(n).startswith("NewHu,") for n in after.iter("node")):
        raise RuntimeError("NewHu task remained in Recents after swipe-away")
    (out / "recents-dismiss-verified.txt").write_text(f"task bounds={card.attrib.get('bounds')} swipe_x={x} from_y={y0}; NewHu card absent afterward\n")
    shell("input", "keyevent", "KEYCODE_HOME")
    time.sleep(0.6)
    shell("monkey", "-p", APP, "1")
    return enter_theme_from_launcher(out)


def switch_theme_and_restore(out):
    nodes = list(dump_ui("theme-before-toggle", out).iter("node"))
    hyper = next((n for n in nodes if n.attrib.get("clickable") == "true" and "HyperOS" in node_text(n)), None)
    liquid = next((n for n in nodes if n.attrib.get("clickable") == "true" and "Liquid Glass" in node_text(n)), None)
    if hyper is None or liquid is None:
        raise RuntimeError("Theme cards were not accessible for quick switch")
    screenshot(out / "theme-before-switch.png")
    tap_node(hyper, "theme-hyperos", out)
    screenshot(out / "theme-hyperos-selected.png")
    nodes = list(dump_ui("theme-after-hyperos", out).iter("node"))
    liquid = next((n for n in nodes if n.attrib.get("clickable") == "true" and "Liquid Glass" in node_text(n)), None)
    if liquid is None:
        raise RuntimeError("Liquid Glass card missing after HyperOS selection")
    tap_node(liquid, "theme-liquid-glass", out)
    time.sleep(0.5)
    restored_nodes = list(dump_ui("theme-restored", out).iter("node"))
    restored = next((n for n in restored_nodes if n.attrib.get("clickable") == "true"
                     and "Liquid Glass" in node_text(n)), None)
    if restored is None or not any(mark in node_text(restored) for mark in ("✓", "✔", "check")):
        raise RuntimeError("Liquid Glass selection was not confirmed after restore")
    screenshot(out / "theme-liquid-glass-restored.png")
    (out / "theme-restored.txt").write_text("Selected Liquid Glass after quick HyperOS switch\n")


def swipe(name, y1, y2, duration, index, out, rows, wait=0.9):
    before = uptime_s()
    shell("input", "swipe", "720", str(y1), "720", str(y2), str(duration))
    after = uptime_s()
    rows.append({"index": index, "name": name, "driver": "ADB input swipe (synthetic)", "duration_ms": duration,
                 "uptime_before": before, "uptime_after": after, "post_touch_wait_ms": int(wait * 1000),
                 "from_x": 720, "from_y": y1, "to_x": 720, "to_y": y2})
    time.sleep(wait)
    screenshot(out / f"{index:02d}-{name}-after.png")


def write_manifest(out, scenario, repeat, apk):
    head = cmd(["git", "rev-parse", "HEAD"], capture=True).strip()
    hashes = []
    for rel in SOURCES:
        hashes.append(f"{hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()}  {rel}")
    (out / "source-hashes.txt").write_text("\n".join(hashes) + "\n")
    local_hash = hashlib.sha256(apk.read_bytes()).hexdigest()
    path_lines = shell("pm", "path", APP).splitlines()
    base = next(line.split(":", 1)[1] for line in path_lines if line.startswith("package:"))
    installed_line = shell("sha256sum", base)
    installed_hash = installed_line.split()[0]
    (out / "apk-hashes.txt").write_text(f"local_apk_sha256={local_hash}\ninstalled_base_apk_sha256={installed_hash}\ndevice_base_apk={base}\n")
    (out / "environment.txt").write_text(
        f"git_head={head}\ndevice={DEVICE}\nmodel={shell('getprop','ro.product.model')}\nandroid={shell('getprop','ro.build.version.release')}\n"
        f"app={APP}\nscenario={scenario}\nrepeat={repeat}\nroute=ThemeSet, samplingSource=routeScene\n"
        f"input=ADB synthetic swipes; input dispatch cadence is not physical touch\nuser_data=preserved; no clear-data\nlocal_apk_sha256={local_hash}\ninstalled_apk_sha256={installed_hash}\n"
    )
    (out / "apk-hash-match.txt").write_text("MATCH\n" if local_hash == installed_hash else "MISMATCH\n")
    if local_hash != installed_hash:
        raise RuntimeError("Local and installed APK bytes differ")
    return base


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in {"cold", "warm", "recent"}:
        raise SystemExit("usage: run-theme-release-repeat.py {cold|warm|recent} REPEAT_INDEX")
    scenario, repeat = sys.argv[1], int(sys.argv[2])
    out = BASE / f"final-{scenario}-{repeat}"
    out.mkdir(parents=True, exist_ok=True)
    apk = ROOT / "android/app/build/outputs/apk/release/app-release.apk"
    write_manifest(out, scenario, repeat, apk)
    (out / "display-before.txt").write_text(shell("dumpsys", "display") + "\n")
    (out / "thermal-before.txt").write_text(shell("dumpsys", "thermalservice") + "\n")
    (out / "gfxinfo-reset.txt").write_text(shell("dumpsys", "gfxinfo", APP, "reset") + "\n")

    config_source = ROOT / "scripts/performance/configs/android-route-frametimeline.pbtxt"
    config = re.sub(r"duration_ms:\s*\d+", "duration_ms: 34000", config_source.read_text(), count=1)
    (out / "trace-config.pbtxt").write_text(config)
    trace_name = f"newhu-themeSet-final-{scenario}-{repeat}-{int(time.time())}.pftrace"
    t0 = time.monotonic()
    with (out / "trace-config.pbtxt").open() as f, (out / "perfetto-start.txt").open("w") as log:
        subprocess.run(ADB + ["shell", "perfetto", "--txt", "--background-wait", "-c", "-", "-o", f"/data/misc/perfetto-traces/{trace_name}"],
                       check=True, stdin=f, stdout=log, stderr=subprocess.STDOUT, timeout=20)
    (out / "trace-start-uptime.txt").write_text(shell("cat", "/proc/uptime") + "\n")
    (out / "pid-before.txt").write_text(process_pid() + "\n")

    if scenario == "cold":
        shell("am", "force-stop", APP)
        shell("monkey", "-p", APP, "1")
        enter_theme_from_launcher(out)
    elif scenario == "warm":
        enter_theme_warm(out)
    else:
        remove_from_recents(out)

    (out / "pid-theme-ready.txt").write_text(process_pid() + "\n")
    (out / "theme-ready-uptime.txt").write_text(f"{uptime_s():.3f}\n")
    screenshot(out / "route-before.png")

    gestures = []
    swipe("up-midrange", 2550, 2250, 280, 0, out, gestures)
    swipe("down-midrange", 2250, 2550, 280, 1, out, gestures)
    swipe("up-toward-lower-bound", 2650, 1150, 320, 2, out, gestures)
    swipe("reverse-from-lower-bound", 1150, 1750, 280, 3, out, gestures)
    swipe("down-toward-upper-bound", 900, 2700, 360, 4, out, gestures)
    swipe("return-top", 900, 2750, 500, 5, out, gestures, wait=0.5)
    switch_theme_and_restore(out)
    swipe("post-theme-up", 2550, 2250, 280, 6, out, gestures)
    (out / "gestures.csv").write_text("index,name,driver,duration_ms,uptime_before,uptime_after,post_touch_wait_ms,from_x,from_y,to_x,to_y\n" +
        "\n".join(",".join(str(row[k]) for k in ("index","name","driver","duration_ms","uptime_before","uptime_after","post_touch_wait_ms","from_x","from_y","to_x","to_y")) for row in gestures) + "\n")
    screenshot(out / "route-after-all-gestures.png")
    (out / "pid-after.txt").write_text(process_pid() + "\n")
    (out / "gfxinfo.txt").write_text(shell("dumpsys", "gfxinfo", APP) + "\n")
    (out / "thermal-after.txt").write_text(shell("dumpsys", "thermalservice") + "\n")
    (out / "display-after.txt").write_text(shell("dumpsys", "display") + "\n")
    (out / "end-uptime.txt").write_text(shell("cat", "/proc/uptime") + "\n")
    time.sleep(max(0, 35 - (time.monotonic() - t0)))
    subprocess.run(ADB + ["pull", f"/data/misc/perfetto-traces/{trace_name}", str(out / "frame-timeline.pftrace")], check=True, timeout=90)
    subprocess.run(["python3", str(ROOT / "scripts/performance/analyze-comments-trace.py"), str(out)], check=True,
                   stdout=(out / "analyzer-console.txt").open("w"), timeout=120)
    subprocess.run(["python3", str(ROOT / "scripts/performance/analyze-posttouch-windows.py"), str(out)], check=True,
                   stdout=(out / "posttouch-console.txt").open("w"), timeout=60)
    sql = "select ct.name,c.ts,c.value from counter c join counter_track ct on ct.id=c.track_id where ct.name like 'NewHuGlass.%' and (ct.name like '%frameScrollY' or ct.name like '%scrollY' or ct.name like '%scrollRangeY' or ct.name like '%drawPath' or ct.name like '%drawCaptureModeHash' or ct.name like '%scrollActive' or ct.name like '%recordWindowElapsedNs' or ct.name like '%vtoTrackedMovement' or ct.name like '%vtoConsumerCount' or ct.name like '%vtoExternalScrollActive' or ct.name like '%consumerInvalidateCount' or ct.name like '%recordOnlyConsumerInvalidateCount' or ct.name like '%touch%') order by c.ts"
    with (out / "liquid-glass-counters.csv").open("w") as f:
        subprocess.run([str(TP), "-Q", sql, str(out / "frame-timeline.pftrace")], check=True, stdout=f, stderr=subprocess.DEVNULL, timeout=180)
    sql_summary = "select ct.name,round(min(c.value),3) min_value,round(max(c.value),3) max_value,count(*) samples from counter c join counter_track ct on ct.id=c.track_id where ct.name like 'NewHuGlass.%' and (ct.name like '%frameScrollY' or ct.name like '%scrollY' or ct.name like '%scrollRangeY' or ct.name like '%drawPath' or ct.name like '%drawCaptureModeHash' or ct.name like '%scrollActive' or ct.name like '%recordWindowElapsedNs' or ct.name like '%vtoTrackedMovement' or ct.name like '%vtoConsumerCount' or ct.name like '%vtoExternalScrollActive' or ct.name like '%consumerInvalidateCount' or ct.name like '%recordOnlyConsumerInvalidateCount' or ct.name like '%touch%') group by ct.name order by ct.name"
    with (out / "liquid-glass-counter-summary.csv").open("w") as f:
        subprocess.run([str(TP), "-Q", sql_summary, str(out / "frame-timeline.pftrace")], check=True, stdout=f, stderr=subprocess.DEVNULL, timeout=180)
    print(f"completed {scenario}-{repeat}: {out}")

if __name__ == "__main__":
    main()
