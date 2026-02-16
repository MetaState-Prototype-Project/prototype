import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { pollId, commitment, proof } = await request.json();
        
        // Validate required fields
        if (!pollId || !commitment || !proof) {
            return NextResponse.json(
                { error: 'Missing required fields: pollId, commitment, proof' },
                { status: 400 }
            );
        }

        // Get the user's session token (this will be handled by Next.js auth)
        // For now, we'll need to implement proper session handling
        
        // Forward the request to the eVoting API
        const evotingApiUrl = process.env.NEXT_PUBLIC_EVOTING_BASE_URL || 'http://localhost:3001';
        const response = await fetch(`${evotingApiUrl}/api/votes/blind`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // TODO: Add proper authentication header
                // 'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ pollId, commitment, proof })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('eVoting API error:', response.status, errorData);
            return NextResponse.json(
                { error: 'Failed to submit blind vote to eVoting API' },
                { status: response.status }
            );
        }

        const result = await response.json();
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error handling blind vote submission:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 