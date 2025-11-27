export enum BinaryTags {
    ListEmpty = 0,
    List8 = 248,
    List16 = 249,
    Binary8 = 252,
    Binary20 = 253,
    Binary32 = 254,
    JidPair = 250,
    JidAd = 247,
    JidFb = 246,
    JidInterop = 245,
    Nibble8 = 255,
    Hex8 = 251,
    Dictionary0 = 236,
    Dictionary1 = 237,
    Dictionary2 = 238,
    Dictionary3 = 239,
}

export const NIBBLE_TOKEN = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", ".", "\ufffd", "\ufffd", "\ufffd", "\ufffd"];
export const HEX_TOKEN = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];

// @ts-ignore
export const DICTIONARY_TOKEN = [DICTIONARY_0_TOKEN, DICTIONARY_1_TOKEN, DICTIONARY_2_TOKEN, DICTIONARY_3_TOKEN];