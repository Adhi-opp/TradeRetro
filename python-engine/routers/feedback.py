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

class FeedbackPayload(BaseModel):
    mostUseful: str = Field("", max_length=MAX_TEXT_LEN)
    copilotBetter: str = Field("", max_length=MAX_TEXT_LEN)
    uiConfusing: str = Field("", max_length=MAX_TEXT_LEN)
    improve: str = Field("", max_length=MAX_TEXT_LEN)
    liked: str = Field("", max_length=MAX_TEXT_LEN)
    ratingOverall: str = Field("", max_length=50)
    ratingEase: str = Field("", max_length=50)
    ratingClarity: str = Field("", max_length=50)
    ratingValue: str = Field("", max_length=50)
    primaryRole: str = Field("", max_length=100)
    experienceLevel: str = Field("", max_length=100)
    email: str = Field("", max_length=200)

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
        payload.copilotBetter.strip(),
        payload.uiConfusing.strip(),
        payload.improve.strip(),
        payload.liked.strip(),
    ])
    has_rating = any([
        payload.ratingOverall, payload.ratingEase,
        payload.ratingClarity, payload.ratingValue
    ])

    if not (has_text or has_rating):
        raise HTTPException(status_code=400, detail="Feedback submission cannot be completely empty.")

    # 2. Server-side timestamp & unique filename generation (prevents path traversal)
    now = datetime.now()
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")
    filename = f"feedback_{timestamp_str}_{_counter:03d}.txt"
    filepath = os.path.join(FEEDBACK_DIR, filename)

    # 3. Format structured content
    lines = [
        f"TradeRetro Feedback Submission",
        f"=============================",
        f"Feedback ID: FB-{now.strftime('%Y%m%d%H%M%S')}-{_counter:03d}",
        f"Timestamp:   {now.isoformat()}",
        f"Email:       {email or 'Not provided'}",
        f"Role:        {payload.primaryRole or 'Not provided'}",
        f"Experience:  {payload.experienceLevel or 'Not provided'}",
        "",
        f"Ratings:",
        f"  Overall Satisfaction: {payload.ratingOverall or 'N/A'}",
        f"  Ease of Use:          {payload.ratingEase or 'N/A'}",
        f"  Clarity of Metrics:   {payload.ratingClarity or 'N/A'}",
        f"  Perceived Value:      {payload.ratingValue or 'N/A'}",
        "",
        f"Detailed Responses:",
        f"-------------------",
        f"[Most Useful Feature]:",
        f"{payload.mostUseful.strip() or 'N/A'}",
        "",
        f"[Copilot Improvement Suggestions]:",
        f"{payload.copilotBetter.strip() or 'N/A'}",
        "",
        f"[UI Confusion Points]:",
        f"{payload.uiConfusing.strip() or 'N/A'}",
        "",
        f"[Single Biggest Improvement Idea]:",
        f"{payload.improve.strip() or 'N/A'}",
        "",
        f"[What Deserves to Stay]:",
        f"{payload.liked.strip() or 'N/A'}",
        ""
    ]

    # 4. Write to text file safely
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to persist feedback submission.")

    return {
        "success": True,
        "message": "Feedback submitted successfully.",
        "feedback_id": f"FB-{now.strftime('%Y%m%d%H%M%S')}-{_counter:03d}"
    }
