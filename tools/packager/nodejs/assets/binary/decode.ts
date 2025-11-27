import { JID, JID_AD, JID_FB, JID_INTEROP, JID_PAIR } from "../jid";
import { BytesToString, DecompressZLib } from "../utils";
// @ts-ignore
import { SINGLE_BYTE_TOKEN, DICTIONARY_0_TOKEN, DICTIONARY_1_TOKEN, DICTIONARY_2_TOKEN, DICTIONARY_3_TOKEN } from "./constants";
import { HEX_TOKEN, NIBBLE_TOKEN, BinaryTags } from "./constants";
import { XMLNode, XMLNodeChildren } from "./node";

export function decodeFromBinary(buffer: Uint8Array): XMLNode {
	const isCompressed = buffer[0] !== 0;

	if (isCompressed) buffer = DecompressZLib(buffer.subarray(1));
	else buffer = buffer.subarray(1);

	let byteOffset = 0;

	function readBytes(bytesSize: number) {
		return buffer.subarray(
			byteOffset,
			byteOffset += bytesSize,
		);
	}

	function readInt(bytesSize: number) {
		return readBytes(bytesSize)
			.reduce((acc, byte, index) => acc | (byte << (8 * (bytesSize - 1 - index))), 0);
	}

	function readNibble8(): string {
		const sizeByte = readInt(1);
		const size = sizeByte & 127;

		let value = "";

		for (let i = 0; i < size; i++) {
			const curByte = readInt(1);

			value += NIBBLE_TOKEN[curByte >> 4];
			value += NIBBLE_TOKEN[curByte & 15];
		}

		if (sizeByte >> 7 !== 0) {
			value = value.slice(0, -1);
		}

		return value
	}

	function readHex8(): string {
		const sizeByte = readInt(1);
		const size = sizeByte & 127;

		let value = "";

		for (let i = 0; i < size; i++) {
			const curByte = readInt(1);

			value += HEX_TOKEN[curByte >> 4];
			value += HEX_TOKEN[curByte & 15];
		}

		if (sizeByte >> 7 !== 0) {
			value = value.slice(0, -1);
		}

		return value
	}

	function readList(size: number) {
		const entries: XMLNode[] = []

		for (let i = 0; i < size; i++) {
			entries.push(readNode());
		}

		return entries
	}

	function readValue(): XMLNode[] | JID | Uint8Array | string {
		const tag = readInt(1);

		if (tag >= 1 && tag < SINGLE_BYTE_TOKEN.length) {
			return SINGLE_BYTE_TOKEN[tag - 1];
		}

		switch (tag) {
			case BinaryTags.ListEmpty:
				return [];
			case BinaryTags.List8:
				return readList(readInt(1));
			case BinaryTags.List16:
				return readList(readInt(2));
			case BinaryTags.Dictionary0:
				return DICTIONARY_0_TOKEN[readInt(1)];
			case BinaryTags.Dictionary1:
				return DICTIONARY_1_TOKEN[readInt(1)];
			case BinaryTags.Dictionary2:
				return DICTIONARY_2_TOKEN[readInt(1)];
			case BinaryTags.Dictionary3:
				return DICTIONARY_3_TOKEN[readInt(1)];
			case BinaryTags.Binary8:
				return readBytes(readInt(1));
			case BinaryTags.Binary20:
				return readBytes(readInt(3));
			case BinaryTags.Binary32:
				return readBytes(readInt(4));
			case BinaryTags.JidPair:
				return new JID_PAIR({
					user: readString(),
					server: readString(),
				});
			case BinaryTags.JidAd:
				return new JID_AD({
					server: readInt(1),
					device: readInt(1),
					user: readString(),
				});
			case BinaryTags.JidFb:
				return new JID_FB({
					user: readString(),
					device: readInt(2),
				});
			case BinaryTags.JidInterop:
				return new JID_INTEROP({
					user: readString(),
					device: readInt(2),
					integrator: readInt(2),
				});
			case BinaryTags.Hex8:
				return readHex8()
			case BinaryTags.Nibble8:
				return readNibble8();
			default:
				throw new Error(`invalid string with tag: ${tag}`);
		}
	}

	function readString(): string {
		const data = readValue();

		if (data instanceof Uint8Array) {
			return BytesToString(data);
		}

		return String(data);
	}

	function readListSize() {
		const tag = readInt(1);

		switch (tag) {
			case BinaryTags.ListEmpty:
				return 0;
			case BinaryTags.List8:
				return readInt(1);
			case BinaryTags.List16:
				return readInt(2);
			default:
				throw new Error(`invalid tag for list size: ${tag}`);
		}
	}

	function readNode() {
		const node = new XMLNode();

		const listSize = readListSize();
		node.tagName = readString();

		if (!listSize || !node.tagName.length) {
			throw new Error("invalid node");
		}

		const attrsLength = (listSize - 1) >> 1;

		for (let i = 0; i < attrsLength; i += 1) {
			const key = readString();
			let value = readValue();

			if (value instanceof Uint8Array) {
				value = BytesToString(value);
			} else if (Array.isArray(value)) {
				value = String(value);
			}

			node.attributes[key] = value;
		}

		if (listSize % 2 == 0) {
			let children = readValue();

			if (children instanceof JID) {
				children = children.toString();
			}

			node.children = children as XMLNodeChildren;
		}

		return node;
	}

	return readNode();
}