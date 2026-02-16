import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { pollId, userId } = await request.json();
        
        // Validate required fields
        if (!pollId || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields: pollId, userId' },
                { status: 400 }
            );
        }

        // Forward the request to the eVoting API
        const evotingApiUrl = process.env.NEXT_PUBLIC_EVOTING_BASE_URL || 'http://localhost:3001';
        const response = await fetch(`${evotingApiUrl}/api/blind-vote/session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pollId, userId })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('eVoting API error:', response.status, errorData);
            return NextResponse.json(
                { error: 'Failed to create blind vote session' },
                { status: response.status }
            );
        }

        const result = await response.json();
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error creating blind vote session:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 