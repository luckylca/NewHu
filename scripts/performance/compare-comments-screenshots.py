#!/usr/bin/env python3
"""Compare same-state Comments screenshots from paired list-engine runs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops
from PIL import ImageStat


def compare(
    left_path: Path,
    right_path: Path,
    crop: tuple[int, int, int, int] | None,
) -> dict[str, object]:
    left = Image.open(left_path).convert("RGB")
    right = Image.open(right_path).convert("RGB")
    if left.size != right.size:
        raise ValueError(f"image dimensions differ: {left.size} != {right.size}")
    if crop:
        left = left.crop(crop)
        right = right.crop(crop)
    difference = ImageChops.difference(left, right)
    histogram = difference.histogram()
    pixel_count = left.width * left.height
    channel_count = pixel_count * 3
    greater_than_four = sum(
        histogram[offset + value]
        for offset in (0, 256, 512)
        for value in range(5, 256)
    )
    return {
        "left": str(left_path),
        "right": str(right_path),
        "dimensions": [left.width, left.height],
        "crop_box": list(crop) if crop else None,
        "mean_absolute_channel_difference": sum(ImageStat.Stat(difference).mean) / 3,
        "channel_values_over_4_percent": greater_than_four * 100 / channel_count,
        "identical": ImageChops.difference(left, right).getbbox() is None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pair",
        action="append",
        required=True,
        metavar="LEFT=RIGHT",
        help="compare two PNG files; may be repeated",
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--crop",
        nargs=4,
        type=int,
        metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"),
        help="optional pixel region shared by both images",
    )
    args = parser.parse_args()

    results = []
    for raw_pair in args.pair:
        left, separator, right = raw_pair.partition("=")
        if not separator or not left or not right:
            parser.error(f"invalid --pair {raw_pair!r}; expected LEFT=RIGHT")
        results.append(compare(Path(left), Path(right), tuple(args.crop) if args.crop else None))

    payload = {"metric": "per-channel RGB absolute difference", "pairs": results}
    encoded = json.dumps(payload, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded)
    print(encoded, end="")


if __name__ == "__main__":
    main()
