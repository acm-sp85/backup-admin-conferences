import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        // 1. Get queue counts
        const queueStats = await query(`
            SELECT status, COUNT(*) as count 
            FROM sponsors_campaign_queue 
            GROUP BY status
        `);

        // 2. Try to fetch the GitLab schedule to see if our credentials are correct
        let gitlabStatus = 'Not tested';
        let gitlabError = null;
        let scheduleActive = null;

        if (process.env.GITLAB_API_TOKEN && process.env.GITLAB_PROJECT_ID && process.env.GITLAB_SCHEDULE_ID) {
            try {
                const gitlabUrl = `https://gitlab.scito.org/api/v4/projects/${encodeURIComponent(process.env.GITLAB_PROJECT_ID)}/pipeline_schedules/${process.env.GITLAB_SCHEDULE_ID}`;
                
                // Test the PUT request to see why it's failing
                const putRes = await fetch(gitlabUrl, {
                    method: 'PUT',
                    headers: {
                        'PRIVATE-TOKEN': process.env.GITLAB_API_TOKEN,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ active: true })
                });
                const putData = await putRes.json();

                const res = await fetch(gitlabUrl, {
                    method: 'GET',
                    headers: {
                        'PRIVATE-TOKEN': process.env.GITLAB_API_TOKEN
                    }
                });
                
                gitlabStatus = res.status;
                const data = await res.json();
                
                if (res.ok) {
                    scheduleActive = data.active;
                } else {
                    gitlabError = data;
                }
            } catch (err) {
                gitlabError = err.message;
            }
        } else {
            gitlabStatus = 'Missing Env Variables';
        }

        return NextResponse.json({
            queueStats,
            gitlab: {
                projectId: process.env.GITLAB_PROJECT_ID,
                scheduleId: process.env.GITLAB_SCHEDULE_ID,
                tokenSet: !!process.env.GITLAB_API_TOKEN,
                httpStatus: gitlabStatus,
                active: scheduleActive,
                putResponse: putData,
                error: gitlabError
            }
        });

    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
