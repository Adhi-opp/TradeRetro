"""
Feedback Router — Simple text file feedback persistence backend.
============================================================
Saves validated user feedback submissions as structured text files under
python-engine/feedback/ with sanitized server-side generated filenames.
"""

import os
import re
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

# Path validation & directory setup
FEEDBACK_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "feedback")
os.makedirs(FEEDBACK_DIR, exist_ok=True)

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_TEXT_LEN = 2000

# Native survey (v2) — matches the current TradeRetro FeedbackModal.
# Legacy keys are kept for backward compatibility with any older client.
class FeedbackPayload(BaseModel):
    mostUseful: str = Field("", max_length=MAX_TEXT_LEN)
    copilotImprove: str = Field("", max_length=MAX_TEXT_LEN)
    confusing: str = Field("", max_length=MAX_TEXT_LEN)
    improve: str = Field("", max_length=MAX_TEXT_LEN)
    liked: str = Field("", max_length=MAX_TEXT_LEN)
    experience: str = Field("", max_length=50)
    navigation: str = Field("", max_length=50)
    helped: str = Field("", max_length=50)
    engine: str = Field("", max_length=50)
    controls: str = Field("", max_length=50)
    metrics: str = Field("", max_length=50)
    copilot: str = Field("", max_length=50)
    copilotHelped: str = Field("", max_length=50)
    ui: str = Field("", max_length=50)
    design: str = Field("", max_length=50)
    email: str = Field("", max_length=200)
    copilotBetter: str = Field("", max_length=MAX_TEXT_LEN)
    uiConfusing: str = Field("", max_length=MAX_TEXT_LEN)
    ratingOverall: str = Field("", max_length=50)
    ratingEase: str = Field("", max_length=50)
    ratingClarity: str = Field("", max_length=50)
    ratingValue: str = Field("", max_length=50)
    primaryRole: str = Field("", max_length=100)
    experienceLevel: str = Field("", max_length=100)

_counter = 0

@router.post("")
async def submit_feedback(payload: FeedbackPayload):
    global _counter
    _counter += 1

    # 1. Validation: Trim whitespace & enforce email regex if present
    email = payload.email.strip()
    if email and not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address format.")

    # Reject empty submission (must have at least one rating or text input)
    has_text = any([
        payload.mostUseful.strip(),
        payload.copilotImprove.strip(),
        payload.confusing.strip(),
        payload.improve.strip(),
        payload.liked.strip(),
        payload.copilotBetter.strip(),
        payload.uiConfusing.strip(),
    ])
    rating_fields = [
        payload.experience, payload.navigation, payload.engine,
        payload.metrics, payload.copilot, payload.ui, payload.design,
        payload.ratingOverall, payload.ratingEase,
        payload.ratingClarity, payload.ratingValue,
    ]
    choice_fields = [payload.helped, payload.controls, payload.copilotHelped]
    has_rating = any([bool(f) for f in rating_fields + choice_fields])

    if not (has_text or has_rating):
        raise HTTPException(status_code=400, detail="Feedback submission cannot be completely empty.")

    # 2. Server-side timestamp & unique filename generation (prevents path traversal)
    now = datetime.now()
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")
    filename = f"feedback_{timestamp_str}_{_counter:03d}.txt"
    filepath = os.path.join(FEEDBACK_DIR, filename)

    # 3. Format structured content
    lines = [
        "TradeRetro Feedback Submission",
        "=============================",
        f"Feedback ID: FB-{now.strftime('%Y%m%d%H%M%S')}-{_counter:03d}",
        f"Timestamp:   {now.isoformat()}",
        f"Email:       {email or 'Not provided'}",
        f"Role:        {payload.primaryRole or 'Not provided'}",
        f"Experience:  {payload.experienceLevel or 'Not provided'}",
        "",
        "Native Survey (v2):",
        f"  Overall feel:      {payload.experience or 'N/A'}",
        f"  Navigation ease:   {payload.navigation or 'N/A'}",
        f"  Helped:            {payload.helped or 'N/A'}",
        f"  Backtest Engine:   {payload.engine or 'N/A'}",
        f"  Controls clarity:  {payload.controls or 'N/A'}",
        f"  Metrics:           {payload.metrics or 'N/A'}",
        f"  AI Copilot:        {payload.copilot or 'N/A'}",
        f"  Copilot helped:    {payload.copilotHelped or 'N/A'}",
        f"  UI / Frontend:     {payload.ui or 'N/A'}",
        f"  Visual design:     {payload.design or 'N/A'}",
        "",
        "Legacy Ratings:",
        f"  Overall Satisfaction: {payload.ratingOverall or 'N/A'}",
        f"  Ease of Use:          {payload.ratingEase or 'N/A'}",
        f"  Clarity of Metrics:   {payload.ratingClarity or 'N/A'}",
        f"  Perceived Value:      {payload.ratingValue or 'N/A'}",
        "",
        "Detailed Responses:",
        "-------------------",
        "[Most Useful Feature]:",
        f"{payload.mostUseful.strip() or 'N/A'}",
        "",
        "[What Could Be Confusing / Hard to Find]:",
        f"{payload.confusing.strip() or 'N/A'}",
        "",
        "[AI Copilot Could Be Better]:",
        f"{payload.copilotImprove.strip() or 'N/A'}",
        "",
        "[Single Biggest Improvement Idea]:",
        f"{payload.improve.strip() or 'N/A'}",
        "",
        "[What Deserves to Stay]:",
        f"{payload.liked.strip() or 'N/A'}",
        "",
        "[Legacy Copilot Suggestions]:",
        f"{payload.copilotBetter.strip() or 'N/A'}",
        "",
        "[Legacy UI Confusion Points]:",
        f"{payload.uiConfusing.strip() or 'N/A'}",
        "",
        f"[Legacy Role]:      {payload.primaryRole or 'Not provided'}",
        f"[Legacy Experience]: {payload.experienceLevel or 'Not provided'}",
        ""
    ]

    # 4. Write to text file safely
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to persist feedback submission.")

    return {
        "success": True,
        "message": "Feedback submitted successfully.",
        "feedback_id": f"FB-{now.strftime('%Y%m%d%H%M%S')}-{_counter:03d}"
    }
