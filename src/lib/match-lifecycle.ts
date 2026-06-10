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

/**
 * Check player in for a match
 */
export async function checkInForMatch(matchId: string, userId: string): Promise<MatchCheckInResponse> {
  try {
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !match) {
      return { success: false, error: "Match not found" };
    }

    // Determine which player is checking in
    const isPlayer1 = match.player1_id === userId;
    const isPlayer2 = match.player2_id === userId;

    if (!isPlayer1 && !isPlayer2) {
      return { success: false, error: "You are not in this match" };
    }

    const field = isPlayer1 ? "player1_checked_in" : "player2_checked_in";

    // Update check-in status
    const { error: updateError } = await supabase
      .from("matches")
      .update({ [field]: true })
      .eq("id", matchId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Fetch updated match
    const { data: updatedMatch } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    // If both players checked in, update match status
    if (updatedMatch?.player1_checked_in && updatedMatch?.player2_checked_in) {
      await supabase
        .from("matches")
        .update({ status: "active" })
        .eq("id", matchId);
    }

    return { success: true, match: updatedMatch };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle player no-show (forfeit)
 */
export async function forfeitMatch(matchId: string, forfeittingUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !match) {
      return { success: false, error: "Match not found" };
    }

    // Determine opponent
    const isPlayer1 = match.player1_id === forfeittingUserId;
    const isPlayer2 = match.player2_id === forfeittingUserId;

    if (!isPlayer1 && !isPlayer2) {
      return { success: false, error: "You are not in this match" };
    }

    const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

    // Close match as forfeit, opponent wins
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        status: "forfeit",
        winner_id: opponentId,
        player1_score: isPlayer1 ? 0 : 3,
        player2_score: isPlayer1 ? 3 : 0,
      })
      .eq("id", matchId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Issue warning strike to forfeitting player
    const { error: strikeError } = await supabase
      .rpc("add_warning_strike", {
        user_id: forfeittingUserId,
        reason: "Missed check-in / no-show",
      });

    if (strikeError) {
      console.warn("Failed to add warning strike:", strikeError);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Flag a match result for admin review
 */
export async function flagMatchResult(
  matchId: string,
  reason: string,
  detailedReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("matches")
      .update({
        status: "disputed",
      })
      .eq("id", matchId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Log flag reason (could be stored in a separate table or as a note)
    console.log(`Match ${matchId} flagged: ${reason} - ${detailedReason}`);

    // Notify admins
    await supabase.from("notifications").insert({
      user_id: null,
      title: "Match Result Flagged",
      body: `Match ${matchId} requires review: ${reason}`,
      link: `/admin/matches/${matchId}`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Verify match result with AI (Gemini Vision)
 * Extracts score, names, and stats from eFootball result screenshot
 */
export async function verifyMatchResultWithAI(
  matchId: string,
  screenshotDataUrl: string,
  declaredScore: { player1: number; player2: number },
  declaredDisplayNames: { player1: string; player2: string }
): Promise<ResultVerificationResponse> {
  try {
    const { data: session } = await supabase.auth.getSession();

    // Call Gemini verification function
    const verifyRes = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-match-result`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          match_id: matchId,
          image_url: screenshotDataUrl,
          declared_score: declaredScore,
          declared_display_names: declaredDisplayNames,
        }),
      }
    );

    const data = await verifyRes.json();

    if (!verifyRes.ok) {
      if (data.flagged) {
        return {
          success: false,
          flagged: true,
          flagReason: data.reason || "Result verification failed",
          error: data.error,
        };
      }
      return { success: false, error: data.error || "Verification failed" };
    }

    return {
      success: true,
      result: data.verified_result,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get match details with player info
 */
export async function getMatchWithPlayerDetails(matchId: string): Promise<any | null> {
  try {
    const { data: match } = await supabase
      .from("matches")
      .select(
        `*,
        player1:player1_id(id, username, phone, efootball_name),
        player2:player2_id(id, username, phone, efootball_name),
        winner:winner_id(id, username)`
      )
      .eq("id", matchId)
      .maybeSingle();

    return match;
  } catch (error) {
    console.error("Failed to get match details:", error);
    return null;
  }
}

/**
 * Check if player can submit result
 * Rules: only if checked in, match is active or recently completed
 */
export async function canPlayerSubmitResult(
  matchId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const match = await getMatchWithPlayerDetails(matchId);

    if (!match) {
      return { allowed: false, reason: "Match not found" };
    }

    if (match.player1_id !== userId && match.player2_id !== userId) {
      return { allowed: false, reason: "You are not in this match" };
    }

    if (!match.player1_checked_in || !match.player2_checked_in) {
      return { allowed: false, reason: "Both players must check in first" };
    }

    if (match.status === "verified" || match.status === "closed") {
      return { allowed: false, reason: "Result already submitted" };
    }

    if (match.status === "forfeit") {
      return { allowed: false, reason: "Match ended by forfeit" };
    }

    return { allowed: true };
  } catch (error: any) {
    return { allowed: false, reason: error.message };
  }
}
