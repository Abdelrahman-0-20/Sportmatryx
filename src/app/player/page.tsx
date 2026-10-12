import { redirect } from "next/navigation";

/**
 * /player is not a standalone page — Player 360 is per-athlete (/player/[id]).
 * Redirect to the roster where each row links into a player view.
 */
export default function PlayerIndex() {
  redirect("/roster");
}