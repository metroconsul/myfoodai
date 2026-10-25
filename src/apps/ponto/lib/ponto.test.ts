import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { ENTRY_TYPE_LABEL, label, needsReview } from "./labels";

describe("toCsv", () => {
  it("uses semicolons, BOM and CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a;b\r\n1;x");
  });
  it("quotes cells with separators, quotes and line breaks", () => {
    expect(toCsv(["n"], [['Ana; "Bia"'], ["l1\nl2"], [null]])).toBe('﻿n\r\n"Ana; ""Bia"""\r\n"l1\nl2"\r\n');
  });
});

describe("labels", () => {
  it("translates known values and falls back to readable text", () => {
    expect(label(ENTRY_TYPE_LABEL, "intervalo_saida")).toBe("Saída para intervalo");
    expect(label(ENTRY_TYPE_LABEL, "outro_tipo")).toBe("outro tipo");
    expect(label(ENTRY_TYPE_LABEL, null)).toBe("—");
  });
  it("flags punches that need review", () => {
    expect(needsReview({ geo_status: "dentro_do_raio", validation_status: "valido" })).toBe(false);
    expect(needsReview({ geo_status: "fora_do_raio", validation_status: "valido" })).toBe(true);
    expect(needsReview({ geo_status: "dentro_do_raio", validation_status: "revisao" })).toBe(true);
  });
});

describe("localYmd", () => {
  it("uses the local calendar day", async () => {
    const { localYmd } = await import("./dates");
    expect(localYmd(new Date(2026, 9, 24, 23, 30))).toBe("2026-10-24");
    expect(localYmd(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
