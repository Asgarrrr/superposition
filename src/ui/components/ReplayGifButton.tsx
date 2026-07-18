// The "share replay GIF" action, shared verbatim by the campaign win overlay
// and the daily overlay: the same copy-confirmation state, 2 s self-clearing
// timer and tape-accent markup. `url` is the ready replay-endpoint link and is
// never null — each overlay decides upstream whether the action exists at all
// (line too long, or a daily still live), so this component only renders it.

import { useState } from "react";
import { m } from "../../paraglide/messages.js";
import { shareOrCopy } from "../dailyShare.ts";

export function ReplayGifButton({ url }: { url: string }) {
  // the copy confirmation is a records moment — one of the rare tape licences;
  // it self-clears so the button rests in paper again.
  const [copied, setCopied] = useState(false);
  const onShare = async () => {
    if ((await shareOrCopy(url)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button
      type="button"
      onClick={onShare}
      className={`font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
        copied ? "text-tape" : "text-paper/35 hover:text-paper/70"
      }`}
    >
      {copied ? m.replay_gif_copied() : m.replay_gif()}
    </button>
  );
}
