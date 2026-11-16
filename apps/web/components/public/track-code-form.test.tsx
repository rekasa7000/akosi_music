import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "@/lib/public-api";
import { TrackCodeForm } from "./track-code-form";

vi.mock("@/lib/public-api", async () => {
  const actual = await vi.importActual<typeof api>("@/lib/public-api");
  return { ...actual, redeemCard: vi.fn() };
});

const redeemCard = vi.mocked(api.redeemCard);

const SAMPLE_TRACK: api.RedeemedTrack = {
  id: "track-1",
  title: "Sample Track",
  trackNumber: 1,
  durationSec: 180,
  mediaType: "AUDIO",
  lyrics: null,
  coverUrl: null,
  releaseId: "release-1",
  releaseTitle: "Sample Release",
  artistName: "Sample Artist",
};

describe("TrackCodeForm", () => {
  it("submits the entered code and reports the unlocked track", async () => {
    redeemCard.mockResolvedValueOnce(SAMPLE_TRACK);
    const onUnlocked = vi.fn();
    const user = userEvent.setup();

    render(<TrackCodeForm onUnlocked={onUnlocked} />);

    await user.type(screen.getByPlaceholderText("Card code"), "AKOSI-0001");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(redeemCard).toHaveBeenCalledWith("AKOSI-0001");
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledWith(SAMPLE_TRACK));
  });

  it("shows the server's error message and doesn't call onUnlocked", async () => {
    redeemCard.mockRejectedValueOnce(new api.PublicApiError("Invalid or revoked card."));
    const onUnlocked = vi.fn();
    const user = userEvent.setup();

    render(<TrackCodeForm onUnlocked={onUnlocked} />);

    await user.type(screen.getByPlaceholderText("Card code"), "BAD-CODE");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText("Invalid or revoked card.")).toBeInTheDocument();
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for a non-API error (e.g. network failure)", async () => {
    redeemCard.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();

    render(<TrackCodeForm onUnlocked={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Card code"), "AKOSI-0001");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });
});
