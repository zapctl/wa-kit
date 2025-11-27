import { JID, JID_AD, JID_FB, JID_INTEROP } from "../jid";
import { BytesToHex, StringToBytes } from "../utils";
// @ts-ignore
import { DICTIONARY_0_TOKEN, DICTIONARY_1_TOKEN, DICTIONARY_2_TOKEN, DICTIONARY_3_TOKEN, SINGLE_BYTE_TOKEN } from "./constants";
import { HEX_TOKEN, NIBBLE_TOKEN, BinaryTags } from "./constants";
import { XMLNode } from "./node";

function isNibble8(str: string): boolean {
	if (str.length > 255 >> 1) return false;
	return /^[0-9.-]+$/.test(str);
}

function isHex8(str: string): boolean {
	if (str.length > 255 >> 1) return false;
	return /^[0-9A-Fa-f]+$/.test(str);
}

export function encodeToBinary(node: XMLNode) {
	const buffer: number[] = [0];

	function writeByte(value: number) {
		buffer.push(value & 0xff);
	}

	function writeBytes(bytes: Uint8Array) {
		const size = bytes.byteLength;

		if (size === 0) {
			writeByte(BinaryTags.ListEmpty);
		} else if (size >= Math.pow(2, 32)) {
			throw new Error(`Bytes too large to encode: ${size} bytes`);
		} else if (size >= (1 << 20)) {
			writeByte(BinaryTags.Binary32);
			writeInt(size, 4);
		} else if (size >= 256) {
			writeByte(BinaryTags.Binary20);
			writeInt(size, 3);
		} else {
			writeByte(BinaryTags.Binary8);
			writeByte(size);
		}

		for (const byte of bytes) {
			writeByte(byte);
		}
	}

	function writeInt(value: number, bytesSize: number) {
		for (let i = 0; i < bytesSize; i++) {
			const byte = (value >> (8 * (bytesSize - 1 - i))) & 0xff;

			writeByte(byte);
		}
	}

	function writeNibble8(str: string) {
		let roundedLength = Math.ceil(str.length / 2);
		if (str.length % 2 !== 0) roundedLength |= 128;

		writeByte(BinaryTags.Nibble8);
		writeByte(roundedLength);

		for (let i = 0; i < str.length; i += 2) {
			const left = NIBBLE_TOKEN.indexOf(str[i]);
			const right = NIBBLE_TOKEN.indexOf(str[i + 1]);

			writeByte((left << 4) | right & 15);
		}
	}

	function writeHex8(str: string) {
		let roundedLength = Math.ceil(str.length / 2);
		if (str.length % 2 !== 0) roundedLength |= 128;

		writeByte(BinaryTags.Hex8);
		writeByte(roundedLength);

		for (let i = 0; i < str.length; i += 2) {
			const left = HEX_TOKEN.indexOf(str[i]);
			const right = HEX_TOKEN.indexOf(str[i + 1]);

			writeByte((left << 4) | right & 15);
		}
	}

	function writeString(str: string) {
		if (SINGLE_BYTE_TOKEN.includes(str)) {
			writeByte(SINGLE_BYTE_TOKEN.indexOf(str) + 1);

		} else if (DICTIONARY_0_TOKEN.includes(str)) {
			writeByte(BinaryTags.Dictionary0);
			writeByte(DICTIONARY_0_TOKEN.indexOf(str));

		} else if (DICTIONARY_1_TOKEN.includes(str)) {
			writeByte(BinaryTags.Dictionary1);
			writeByte(DICTIONARY_1_TOKEN.indexOf(str));

		} else if (DICTIONARY_2_TOKEN.includes(str)) {
			writeByte(BinaryTags.Dictionary2);
			writeByte(DICTIONARY_2_TOKEN.indexOf(str));

		} else if (DICTIONARY_3_TOKEN.includes(str)) {
			writeByte(BinaryTags.Dictionary3);
			writeByte(DICTIONARY_3_TOKEN.indexOf(str));

		} else {
			writeBytes(StringToBytes(str));
		}
	}

	function writeJID(jid: JID) {
		if (jid instanceof JID_AD) {
			writeByte(BinaryTags.JidAd);
			writeByte(jid.domain || 0);
			writeInt(jid.device || 0, 1);
			writeString(jid.user);
		} else if (jid instanceof JID_FB) {
			writeByte(BinaryTags.JidFb);
			writeString(jid.user);
			writeInt(jid.device, 2);
		} else if (jid instanceof JID_INTEROP) {
			writeByte(BinaryTags.JidInterop);
			writeString(jid.user);
			writeInt(jid.device, 2);
			writeInt(jid.integrator, 2);
		} else if (jid instanceof JID) {
			writeByte(BinaryTags.JidPair);
			writeString(jid.user || "");
			writeString(jid.server);
		}
	}

	function writeListSize(size: number) {
		if (size === 0) {
			writeByte(BinaryTags.ListEmpty);
		} else if (size < 256) {
			writeByte(BinaryTags.List8);
			writeByte(size);
		} else {
			writeByte(BinaryTags.List16);
			writeInt(size, 2);
		}
	}

	function writeValue(value?: XMLNode[] | JID | Uint8Array | string) {
		if (value instanceof Uint8Array) {
			writeBytes(value);

		} else if (Array.isArray(value)) {
			writeListSize(value.length);
			for (const child of value) writeNode(child);

		} else if (value instanceof JID) {
			writeJID(value);
		} else if (typeof value === "string") {
			if (isHex8(value)) {
				writeHex8(value);
			} else if (isNibble8(value)) {
				writeNibble8(value);
			} else {
				writeString(value);
			}
		}
	}

	function writeNode(node: XMLNode) {
		const attributes = Object.entries(node.attributes)
			.filter(([_, val]) => val != null);

		const listSize = 1 +
			(2 * attributes.length) +
			(node.children.length ? 1 : 0);

		writeListSize(listSize);
		writeString(node.tagName);

		for (const [key, value] of attributes) {
			writeString(key);
			writeValue(value);
		}

		if (node.children.length > 0) {
			writeValue(node.children);
		}
	}

	writeNode(node);

	return Uint8Array.from(buffer);
}

export function encodeToString(node: XMLNode): string {
	const attrs = (() => {
		const attributes = Object.entries(node.attributes)
			.filter(([_, val]) => val != null)
			.map(([key, val]) => `${key}="${val}"`)
			.join(" ");

		if (!attributes.length) return "";
		return ` ${attributes}`;
	})();

	const tagName = node.tagName;

	if (node.children && node.children.length > 0) {
		let children = "";

		if (node.children instanceof Uint8Array) {
			if (node.children.length > 2048) children = `<!-- ${node.children.length} bytes -->`;
			else children = BytesToHex(node.children);
		} else if (typeof node.children === "string") {
			children = `"${node.children}"`;
		} else if (Array.isArray(node.children)) {
			children = node.children.map(node => node.toString()).join("");
		} else {
			children = String(node.children);
		}

		return `<${tagName}${attrs}>${children}</${tagName}>`;
	}

	return `<${tagName}${attrs} />`;
}