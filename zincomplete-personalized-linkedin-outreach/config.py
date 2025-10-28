# config.py
YOUR_NAME = "Syndicate Solutions"
YOUR_SERVICES = "video editing, social media management, websites, apps, and marketing campaigns"
YOUR_VALUE = f"I help businesses like yours execute digital projects—from {YOUR_SERVICES}—at fair, transparent prices."

# Personalization rules (add more based on your niche)
PERSONALIZATION_RULES = [
    {
        "keywords": ["founder", "ceo", "owner", "entrepreneur"],
        "hook": "building {company} in today's market takes serious vision"
    },
    {
        "keywords": ["video", "content", "creator", "youtube", "tiktok"],
        "hook": "your content style really stands out—especially how you {detail}"
    },
    {
        "keywords": ["marketing", "growth", "campaign", "social media"],
        "hook": "your approach to marketing at {company} caught my eye"
    },
    {
        "keywords": ["developer", "engineer", "tech", "app", "software"],
        "hook": "what you're building at {company} looks technically impressive"
    },
    {
        "keywords": ["design", "creative", "brand", "visual"],
        "hook": "your eye for design is evident in {company}'s branding"
    }
]

FALLBACK_HOOK = "what you're building at {company}"