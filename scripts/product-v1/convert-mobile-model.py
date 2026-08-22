from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from onnx import AttributeProto, TensorProto, numpy_helper
from tokenizers import Tokenizer


def convert_type(type_proto: onnx.TypeProto) -> None:
    if type_proto.HasField("tensor_type"):
        if type_proto.tensor_type.elem_type == TensorProto.FLOAT16:
            type_proto.tensor_type.elem_type = TensorProto.FLOAT
    elif type_proto.HasField("sequence_type"):
        convert_type(type_proto.sequence_type.elem_type)
    elif type_proto.HasField("optional_type"):
        convert_type(type_proto.optional_type.elem_type)


def convert_tensor(tensor: onnx.TensorProto) -> None:
    if tensor.data_type != TensorProto.FLOAT16:
        return
    replacement = numpy_helper.from_array(
        numpy_helper.to_array(tensor).astype(np.float32),
        name=tensor.name,
    )
    tensor.CopyFrom(replacement)


def convert_graph(graph: onnx.GraphProto) -> None:
    for value_info in [*graph.input, *graph.output, *graph.value_info]:
        convert_type(value_info.type)
    for initializer in graph.initializer:
        convert_tensor(initializer)
    for initializer in graph.sparse_initializer:
        convert_tensor(initializer.values)

    for node in graph.node:
        for attribute in node.attribute:
            if node.op_type == "Cast" and attribute.name == "to" and attribute.i == TensorProto.FLOAT16:
                attribute.i = TensorProto.FLOAT
            elif attribute.type == AttributeProto.TENSOR:
                convert_tensor(attribute.t)
            elif attribute.type == AttributeProto.TENSORS:
                for tensor in attribute.tensors:
                    convert_tensor(tensor)
            elif attribute.type == AttributeProto.GRAPH:
                convert_graph(attribute.g)
            elif attribute.type == AttributeProto.GRAPHS:
                for nested_graph in attribute.graphs:
                    convert_graph(nested_graph)


def convert_model(source: Path, output: Path) -> None:
    model = onnx.load(source)
    convert_graph(model.graph)
    metadata = {item.key: item.value for item in model.metadata_props}
    metadata["newhu.mobile_precision"] = "FP32 derived from frozen FP16 weights"
    del model.metadata_props[:]
    for key, value in metadata.items():
        item = model.metadata_props.add()
        item.key = key
        item.value = value
    onnx.checker.check_model(model)
    output.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, output)


def build_inputs(tokenizer: Tokenizer, texts: list[str]) -> tuple[np.ndarray, np.ndarray]:
    input_ids = np.zeros((len(texts), 256), dtype=np.int64)
    attention_mask = np.zeros((len(texts), 256), dtype=np.int64)
    for row, text in enumerate(texts):
        ids = tokenizer.encode(text).ids[:256]
        input_ids[row, : len(ids)] = ids
        attention_mask[row, : len(ids)] = 1
    return input_ids, attention_mask


def infer(session: ort.InferenceSession, tokenizer: Tokenizer, texts: list[str]) -> np.ndarray:
    outputs: list[np.ndarray] = []
    for start in range(0, len(texts), 8):
        input_ids, attention_mask = build_inputs(tokenizer, texts[start : start + 8])
        outputs.append(session.run(["embedding"], {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
        })[0])
    return np.concatenate(outputs, axis=0)


def report_parity(source: Path, output: Path, tokenizer_path: Path, golden_path: Path) -> None:
    rows = [json.loads(line) for line in golden_path.read_text(encoding="utf-8").splitlines() if line]
    texts = [row["text"] for row in rows]
    golden = np.asarray([row["embedding"] for row in rows], dtype=np.float32)
    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    original = infer(ort.InferenceSession(str(source), providers=["CPUExecutionProvider"]), tokenizer, texts)
    mobile = infer(ort.InferenceSession(str(output), providers=["CPUExecutionProvider"]), tokenizer, texts)

    source_max_abs = float(np.max(np.abs(original - golden)))
    mobile_max_abs = float(np.max(np.abs(mobile - golden)))
    mobile_norm_error = float(np.max(np.abs(np.linalg.norm(mobile, axis=1) - 1)))
    cosine = np.sum(mobile * golden, axis=1) / np.maximum(
        np.linalg.norm(mobile, axis=1) * np.linalg.norm(golden, axis=1),
        1e-12,
    )
    print(f"SOURCE_GOLDEN_MAX_ABS={source_max_abs:.8g}")
    print(f"MOBILE_GOLDEN_MAX_ABS={mobile_max_abs:.8g}")
    print(f"MOBILE_GOLDEN_MIN_COSINE={float(np.min(cosine)):.10f}")
    print(f"MOBILE_MAX_NORM_ERROR={mobile_norm_error:.8g}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--tokenizer", type=Path, required=True)
    parser.add_argument("--golden", type=Path, required=True)
    args = parser.parse_args()
    convert_model(args.source, args.output)
    report_parity(args.source, args.output, args.tokenizer, args.golden)


if __name__ == "__main__":
    main()
