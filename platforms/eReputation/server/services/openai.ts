import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface ReputationAnalysis {
  score: number; // 1-10 scale
  confidence: number; // 0-1 scale
  analysis: string;
  factors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
}

export async function analyzeReputation(
  targetType: string,
  targetName: string,
  variables: string[],
  additionalContext?: string
): Promise<ReputationAnalysis> {
  try {
    const prompt = `
Analyze the professional reputation for the following entity:

Target Type: ${targetType}
Target Name: ${targetName}
Analysis Variables: ${variables.join(", ")}
${additionalContext ? `Additional Context: ${additionalContext}` : ""}

Please provide a comprehensive reputation analysis considering the specified variables. 
Evaluate based on professional standards, credibility, reliability, and overall standing.

Respond with JSON in this exact format:
{
  "score": number (1-10 scale where 10 is excellent reputation),
  "confidence": number (0-1 scale indicating confidence in analysis),
  "analysis": "detailed explanation of the reputation assessment",
  "factors": {
    "positive": ["list of positive reputation factors"],
    "negative": ["list of negative reputation factors"],
    "neutral": ["list of neutral factors"]
  }
}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional reputation analyst. Provide objective, fair assessments based on available information. Focus on professional credibility, reliability, and standing in the community."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      score: Math.max(1, Math.min(10, Math.round(result.score * 10) / 10)),
      confidence: Math.max(0, Math.min(1, result.confidence)),
      analysis: result.analysis || "Analysis could not be completed.",
      factors: {
        positive: result.factors?.positive || [],
        negative: result.factors?.negative || [],
        neutral: result.factors?.neutral || [],
      },
    };
  } catch (error) {
    console.error("Error analyzing reputation:", error);
    throw new Error("Failed to analyze reputation. Please try again.");
  }
}

export async function analyzeReference(
  referenceText: string,
  referenceType: string,
  targetName: string
): Promise<{ sentiment: string; quality: number; summary: string }> {
  try {
    const prompt = `
Analyze the following professional reference:

Reference Type: ${referenceType}
Target: ${targetName}
Reference Text: ${referenceText}

Evaluate the quality and sentiment of this reference. Consider:
- Specificity and detail
- Professional language
- Credibility indicators
- Overall sentiment

Respond with JSON in this format:
{
  "sentiment": "positive|neutral|negative",
  "quality": number (1-10 scale),
  "summary": "brief summary of the reference quality and key points"
}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional reference analyst. Evaluate references objectively for quality, specificity, and professional value."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      sentiment: result.sentiment || "neutral",
      quality: Math.max(1, Math.min(10, result.quality || 5)),
      summary: result.summary || "Reference analysis completed.",
    };
  } catch (error) {
    console.error("Error analyzing reference:", error);
    throw new Error("Failed to analyze reference. Please try again.");
  }
}
