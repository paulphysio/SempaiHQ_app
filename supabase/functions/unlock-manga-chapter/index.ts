// Retired (2026-11-17). This function decrypted a reader's wallet ON THE
// SERVER and signed payments with it — the kind of key handling that was
// abused in the wallet thefts. Manga chapters are paid from the reader's own
// wallet and recorded by record-manga-payment instead.
Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "This payment method has been retired. Please unlock manga chapters in the SempaiHQ app." }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
