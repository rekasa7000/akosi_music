import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "@/lib/public-api";
import { FeedbackForm } from "./feedback-form";

vi.mock("@/lib/public-api", async () => {
  const actual = await vi.importActual<typeof api>("@/lib/public-api");
  return { ...actual, submitFeedback: vi.fn() };
});

const submitFeedback = vi.mocked(api.submitFeedback);

describe("FeedbackForm", () => {
  it("submits a star rating alongside the message for type=FEEDBACK", async () => {
    submitFeedback.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();

    render(
      <FeedbackForm
        type="FEEDBACK"
        title="How are we doing?"
        description="Tell us what you think."
        messageLabel="Your feedback"
        messagePlaceholder="..."
      />,
    );

    await user.click(screen.getByRole("button", { name: "4 stars" }));
    await user.type(screen.getByLabelText("Your feedback"), "Loved the sound quality.");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(submitFeedback).toHaveBeenCalledWith({
        type: "FEEDBACK",
        message: "Loved the sound quality.",
        rating: 4,
        contactEmail: undefined,
        releaseId: undefined,
        trackId: undefined,
      }),
    );
    expect(await screen.findByText(/thanks — got it/i)).toBeInTheDocument();
  });

  it("never sends a rating for type=ERROR, even without the star UI rendered", async () => {
    submitFeedback.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();

    render(
      <FeedbackForm
        type="ERROR"
        title="Something broken?"
        description="Tell us what happened."
        messageLabel="What went wrong"
        messagePlaceholder="..."
      />,
    );

    expect(screen.queryByRole("button", { name: /stars?/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("What went wrong"), "The player froze on play.");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ERROR", rating: undefined }),
      ),
    );
  });

  it("shows the server error inline and leaves the form open to retry", async () => {
    submitFeedback.mockRejectedValueOnce(new api.PublicApiError("Message is required."));
    const user = userEvent.setup();

    render(
      <FeedbackForm
        type="ERROR"
        title="Something broken?"
        description="Tell us what happened."
        messageLabel="What went wrong"
        messagePlaceholder="..."
      />,
    );

    await user.type(screen.getByLabelText("What went wrong"), "x");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Message is required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });
});
