import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERACTIVE_LIMITS,
  sendInteractiveButtons,
  sendInteractiveList,
  sendInteractiveCarousel,
  type InteractiveCarouselCard,
} from "./meta-api";

// All assertions in this file run BEFORE the network call. We stub fetch
// to a never-resolving mock so a test that accidentally falls through to
// the request body would hang (and fail) rather than silently hit
// graph.facebook.com.
const neverFetch = () =>
  new Promise<Response>(() => {
    /* intentionally never resolves */
  });

const BASE_ARGS = {
  phoneNumberId: "test-phone",
  accessToken: "test-token",
  to: "1234567890",
  bodyText: "Body text",
} as const;

describe("sendInteractiveButtons — validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(neverFetch));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an empty buttons array", async () => {
    await expect(
      sendInteractiveButtons({ ...BASE_ARGS, buttons: [] }),
    ).rejects.toThrow(/1-3 buttons/);
  });

  it(`rejects more than ${INTERACTIVE_LIMITS.maxButtons} buttons (Meta cap)`, async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [
          { id: "a", title: "A" },
          { id: "b", title: "B" },
          { id: "c", title: "C" },
          { id: "d", title: "D" },
        ],
      }),
    ).rejects.toThrow(/1-3 buttons/);
  });

  it("rejects a button title longer than 20 chars (Meta cap)", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [
          { id: "a", title: "x".repeat(INTERACTIVE_LIMITS.buttonTitleMaxLength + 1) },
        ],
      }),
    ).rejects.toThrow(/exceeds 20 chars/);
  });

  it("rejects a button missing its id", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [{ id: "", title: "Choose me" }],
      }),
    ).rejects.toThrow(/missing id/);
  });

  it("rejects an empty body text", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        bodyText: "",
        buttons: [{ id: "a", title: "A" }],
      }),
    ).rejects.toThrow(/requires bodyText/);
  });

  it("rejects a header text over the limit", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        headerText: "x".repeat(INTERACTIVE_LIMITS.headerTextMaxLength + 1),
        buttons: [{ id: "a", title: "A" }],
      }),
    ).rejects.toThrow(/headerText exceeds/);
  });

  it("sends the right payload shape when all inputs are valid", async () => {
    let captured: { url: string; body: unknown; method: string } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        captured = {
          url,
          method: init.method ?? "GET",
          body: JSON.parse(String(init.body)),
        };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.PASS" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendInteractiveButtons({
      ...BASE_ARGS,
      headerText: "Hello",
      footerText: "Tap one",
      buttons: [
        { id: "yes", title: "Yes" },
        { id: "no", title: "No" },
      ],
    });

    expect(result).toEqual({ messageId: "wamid.PASS" });
    expect(captured).not.toBeNull();
    expect(captured!.method).toBe("POST");
    expect(captured!.url).toContain("test-phone/messages");
    expect(captured!.body).toMatchObject({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "1234567890",
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Body text" },
        header: { type: "text", text: "Hello" },
        footer: { text: "Tap one" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "yes", title: "Yes" } },
            { type: "reply", reply: { id: "no", title: "No" } },
          ],
        },
      },
    });
  });
});

describe("sendInteractiveList — validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(neverFetch));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ROW = { id: "r1", title: "Row 1" };

  it("rejects zero sections", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [],
      }),
    ).rejects.toThrow(/1-10 sections/);
  });

  it(`rejects more than ${INTERACTIVE_LIMITS.maxListRowsTotal} rows total across sections (Meta cap)`, async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `r${i}`,
      title: `Row ${i}`,
    }));
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [{ rows }],
      }),
    ).rejects.toThrow(/1-10 rows total/);
  });

  it("rejects a row title longer than 24 chars (Meta cap)", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [
          {
            rows: [
              {
                id: "r1",
                title: "x".repeat(INTERACTIVE_LIMITS.listRowTitleMaxLength + 1),
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow(/exceeds 24 chars/);
  });

  it("rejects duplicate row ids across sections", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [
          { rows: [{ id: "dupe", title: "First" }] },
          { rows: [{ id: "dupe", title: "Second" }] },
        ],
      }),
    ).rejects.toThrow(/duplicate row id/);
  });

  it("rejects an empty buttonLabel", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "",
        sections: [{ rows: [ROW] }],
      }),
    ).rejects.toThrow(/requires a buttonLabel/);
  });

  it("sends the right payload shape when valid", async () => {
    let captured: { body: unknown } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = { body: JSON.parse(String(init.body)) };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.LIST" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendInteractiveList({
      ...BASE_ARGS,
      buttonLabel: "Open menu",
      sections: [
        {
          title: "Orders",
          rows: [
            { id: "order_1", title: "Order #1", description: "€12" },
            { id: "order_2", title: "Order #2" },
          ],
        },
      ],
    });

    expect(result).toEqual({ messageId: "wamid.LIST" });
    expect(captured).not.toBeNull();
    expect(captured!.body).toMatchObject({
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "Body text" },
        action: {
          button: "Open menu",
          sections: [
            {
              title: "Orders",
              rows: [
                { id: "order_1", title: "Order #1", description: "€12" },
                { id: "order_2", title: "Order #2" },
              ],
            },
          ],
        },
      },
    });
  });
});

describe("sendInteractiveCarousel — validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(neverFetch));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const CARD_A: InteractiveCarouselCard = {
    headerType: "image",
    headerUrl: "https://example.com/a.jpg",
    bodyText: "Sandalwood — ₹1,499",
    buttonLabel: "Buy now",
    buttonUrl: "https://shop.example.com/sandalwood",
  };
  const CARD_B: InteractiveCarouselCard = {
    headerType: "video",
    headerUrl: "https://example.com/b.mp4",
    bodyText: "Gift Set — ₹3,999",
    buttonLabel: "Buy now",
    buttonUrl: "https://shop.example.com/gift-set",
  };

  it(`rejects fewer than ${INTERACTIVE_LIMITS.minCarouselCards} cards`, async () => {
    await expect(
      sendInteractiveCarousel({ ...BASE_ARGS, buttonMode: "url", cards: [CARD_A] }),
    ).rejects.toThrow(/2-10 cards/);
  });

  it(`rejects more than ${INTERACTIVE_LIMITS.maxCarouselCards} cards (Meta cap)`, async () => {
    const cards = Array.from({ length: 11 }, () => CARD_A);
    await expect(
      sendInteractiveCarousel({ ...BASE_ARGS, buttonMode: "url", cards }),
    ).rejects.toThrow(/2-10 cards/);
  });

  it("rejects a card body longer than 160 chars (Meta cap)", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        buttonMode: "url",
        cards: [
          { ...CARD_A, bodyText: "x".repeat(INTERACTIVE_LIMITS.carouselCardBodyMaxLength + 1) },
          CARD_B,
        ],
      }),
    ).rejects.toThrow(/exceeds 160 chars/);
  });

  it("rejects a card button label longer than 20 chars (Meta cap)", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        buttonMode: "url",
        cards: [
          { ...CARD_A, buttonLabel: "x".repeat(INTERACTIVE_LIMITS.buttonTitleMaxLength + 1) },
          CARD_B,
        ],
      }),
    ).rejects.toThrow(/exceeds 20 chars/);
  });

  it("rejects a url-mode card missing buttonUrl", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        buttonMode: "url",
        cards: [{ ...CARD_A, buttonUrl: undefined }, CARD_B],
      }),
    ).rejects.toThrow(/needs a destination URL/);
  });

  it("rejects a quick_reply-mode card missing buttonId, and duplicate buttonIds", async () => {
    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        buttonMode: "quick_reply",
        cards: [
          { ...CARD_A, buttonUrl: undefined, buttonId: undefined },
          { ...CARD_B, buttonUrl: undefined, buttonId: "card_b" },
        ],
      }),
    ).rejects.toThrow(/missing an id/);

    await expect(
      sendInteractiveCarousel({
        ...BASE_ARGS,
        buttonMode: "quick_reply",
        cards: [
          { ...CARD_A, buttonUrl: undefined, buttonId: "dup" },
          { ...CARD_B, buttonUrl: undefined, buttonId: "dup" },
        ],
      }),
    ).rejects.toThrow(/duplicate card button id/);
  });

  it("sends the right payload shape for url-mode cards", async () => {
    let captured: { body: unknown } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = { body: JSON.parse(String(init.body)) };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.CAROUSEL" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendInteractiveCarousel({
      ...BASE_ARGS,
      buttonMode: "url",
      cards: [CARD_A, CARD_B],
    });

    expect(result).toEqual({ messageId: "wamid.CAROUSEL" });
    expect(captured).not.toBeNull();
    expect(captured!.body).toMatchObject({
      type: "interactive",
      interactive: {
        type: "carousel",
        body: { text: "Body text" },
        action: {
          cards: [
            {
              card_index: 0,
              type: "cta_url",
              header: { type: "image", image: { link: "https://example.com/a.jpg" } },
              body: { text: "Sandalwood — ₹1,499" },
              action: {
                name: "cta_url",
                parameters: { display_text: "Buy now", url: "https://shop.example.com/sandalwood" },
              },
            },
            {
              card_index: 1,
              type: "cta_url",
              header: { type: "video", video: { link: "https://example.com/b.mp4" } },
              action: {
                name: "cta_url",
                parameters: { display_text: "Buy now", url: "https://shop.example.com/gift-set" },
              },
            },
          ],
        },
      },
    });
  });

  it("sends the right payload shape for quick_reply-mode cards", async () => {
    let captured: { body: unknown } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = { body: JSON.parse(String(init.body)) };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.CAROUSEL_QR" }] }),
          { status: 200 },
        );
      }),
    );

    await sendInteractiveCarousel({
      ...BASE_ARGS,
      buttonMode: "quick_reply",
      cards: [
        { ...CARD_A, buttonUrl: undefined, buttonId: "card_a" },
        { ...CARD_B, buttonUrl: undefined, buttonId: "card_b" },
      ],
    });

    expect(captured).not.toBeNull();
    expect(captured!.body).toMatchObject({
      interactive: {
        type: "carousel",
        action: {
          cards: [
            {
              card_index: 0,
              type: "cta_url",
              action: {
                buttons: [{ type: "quick_reply", quick_reply: { id: "card_a", title: "Buy now" } }],
              },
            },
            {
              card_index: 1,
              type: "cta_url",
              action: {
                buttons: [{ type: "quick_reply", quick_reply: { id: "card_b", title: "Buy now" } }],
              },
            },
          ],
        },
      },
    });
  });
});
