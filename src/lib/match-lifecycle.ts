/**
 * Match Lifecycle Management
 * Handles check-in, result submission, verification, and forfeit logic
 */

import { supabase } from "@/integrations/supabase/client";

export interface MatchCheckInResponse {
  success: boolean;
  match?: any;
  error?: string;
}

export interface ResultVerificationResponse {
  success: boolean;
  result?: {
    player1_score: number;
    player2_score: number;
    winner?: string;
    stats?: Record<string, any>;
  };
  error?: string;
  flagged?: boolean;
  flagReason?: string;
}

export async function checkInForMatch(matchId: string, userId: string): Promise<MatchCheckInResponse> {
  try {
    const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
    if (matchError || !match) return { success: false, error: "Match not found" };
    const isPlayer1 = match.player1_id === userId;
    const isPlayer2 = match.player2_id === userId;
    if (!isPlayer1 && !isPlayer2) return { success: false, error: "You are not in this match" };

    const update: any = isPlayer1 ? { player1_checked_in: true } : { player2_checked_in: true };
    const { error: updateError } = await supabase.from("matches").update(update).eq("id", matchId);
    if (updateError) return { success: false, error: updateError.message };

    const { data: updatedMatch } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
    if (updatedMatch?.player1_checked_in && updatedMatch?.player2_checked_in) {
      await supabase.from("matches").update({ status: "active" }).eq("id", matchId);
    }
    return { success: true, match: updatedMatch };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function forfeitMatch(matchId: string, forfeittingUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
    if (matchError || !match) return { success: false, error: "Match not found" };
    const isPlayer1 = match.player1_id === forfeittingUserId;
    const isPlayer2 = match.player2_id === forfeittingUserId;
    if (!isPlayer1 && !isPlayer2) return { success: false, error: "You are not in this match" };

    const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
    const { error: updateError } = await supabase.from("matches").update({
      status: "forfeit",
      winner_id: opponentId,
      player1_score: isPlayer1 ? 0 : 3,
      player2_score: isPlayer1 ? 3 : 0,
    }).eq("id", matchId);
    if (updateError) return { success: false, error: updateError.message };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function flagMatchResult(matchId: string, reason: string, detailedReason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("matches").update({ status: "disputed" }).eq("id", matchId);
    if (error) return { success: false, error: error.message };
    console.log(`Match ${matchId} flagged: ${reason} - ${detailedReason}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getMatchWithPlayerDetails(matchId: string): Promise<any | null> {
  try {
    const { data: match } = await supabase.from("matches").select(
      "*, player1:player1_id(id, username, phone, efootball_name), player2:player2_id(id, username, phone, efootball_name), winner:winner_id(id, username)"
    ).eq("id", matchId).maybeSingle();
    return match;
  } catch (error) {
    console.error("Failed to get match details:", error);
    return null;
  }
}

export async function canPlayerSubmitResult(matchId: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const match = await getMatchWithPlayerDetails(matchId);
    if (!match) return { allowed: false, reason: "Match not found" };
    if (match.player1_id !== userId && match.player2_id !== userId) return { allowed: false, reason: "You are not in this match" };
    if (!match.player1_checked_in || !match.player2_checked_in) return { allowed: false, reason: "Both players must check in first" };
    if (match.status === "verified" || match.status === "closed") return { allowed: false, reason: "Result already submitted" };
    if (match.status === "forfeit") return { allowed: false, reason: "Match ended by forfeit" };
    return { allowed: true };
  } catch (error: any) {
    return { allowed: false, reason: error.message };
  }
}
