import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Always return active status and pro plan to unlock all dashboard features
  const status = 'active';
  const plan = 'pro';

  const subscription = {
    plan, // pro plan unlocked
    status, // active status unlocked
    gracePeriodDaysRemaining: 0,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const response = NextResponse.json(subscription);

  // Set cookies to keep browser local state in sync
  response.cookies.set('midevela_mock_status', 'active', { path: '/' });
  response.cookies.set('midevela_mock_plan', 'pro', { path: '/' });

  return response;
}
