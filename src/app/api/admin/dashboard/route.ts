import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

async function count(sql: string, params: (string | number)[] = []) {
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
  return Number(rows[0]?.total || 0);
}

export const GET = withAdmin(async () => {
  try {
    const [
      pendingAthleteClaims,
      pendingResultSubmissions,
      reviewingResultSubmissions,
      pendingIdentityLinks,
      needsReviewResults,
      pendingResults,
      brandsDraft,
      productsDraft,
      athletesDraft,
      creatorsDraft,
      eventsDraft,
      coursesDraft,
      techniquesDraft,
      articlesDraft,
      questionsDraft,
      docsDraft,
      shopDraft,
    ] = await Promise.all([
      count("SELECT COUNT(*) AS total FROM sup_athlete_profile_claims WHERE status = 'pending'"),
      count("SELECT COUNT(*) AS total FROM sup_event_result_submissions WHERE status = 'pending'"),
      count("SELECT COUNT(*) AS total FROM sup_event_result_submissions WHERE status = 'reviewing'"),
      count("SELECT COUNT(*) AS total FROM sup_athlete_identity_links WHERE status = 'pending'"),
      count("SELECT COUNT(*) AS total FROM sup_event_results WHERE review_status = 'needs_review'"),
      count("SELECT COUNT(*) AS total FROM sup_event_results WHERE review_status = 'pending'"),
      count("SELECT COUNT(*) AS total FROM sup_brands WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_products WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_athletes WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_creators WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_events WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_courses WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_techniques WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_articles WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_quiz_questions WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_learn_articles WHERE status = 'draft'"),
      count("SELECT COUNT(*) AS total FROM sup_shop_items WHERE status = 'draft'"),
    ]);

    const [recentClaimRows] = await pool.execute<RowDataPacket[]>(
      `SELECT '资料审批' AS type, CONCAT(a.name, ' / ', u.nickname) AS title, c.status, c.created_at, '/admin/athlete-claims' AS href
        FROM sup_athlete_profile_claims c
        INNER JOIN sup_athletes a ON a.athlete_id = c.athlete_id
        INNER JOIN sup_users u ON u.user_id = c.user_id
        ORDER BY c.created_at DESC
        LIMIT 4`
    );

    const [recentSubmissionRows] = await pool.execute<RowDataPacket[]>(
      `SELECT '成绩册提交' AS type, s.event_name AS title, s.status, s.created_at, '/admin/event-result-submissions' AS href
        FROM sup_event_result_submissions s
        ORDER BY s.created_at DESC
        LIMIT 4`
    );

    const recentItems = [...recentClaimRows, ...recentSubmissionRows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);

    const draftContent = {
      brands: brandsDraft,
      products: productsDraft,
      athletes: athletesDraft,
      creators: creatorsDraft,
      events: eventsDraft,
      courses: coursesDraft,
      techniques: techniquesDraft,
      articles: articlesDraft,
      questions: questionsDraft,
      docs: docsDraft,
      shop: shopDraft,
    };

    return NextResponse.json({
      todos: {
        pendingAthleteClaims,
        pendingResultSubmissions,
        reviewingResultSubmissions,
        pendingIdentityLinks,
        needsReviewResults,
        pendingResults,
        draftContentTotal: Object.values(draftContent).reduce((sum, value) => sum + value, 0),
      },
      draftContent,
      recentItems,
    });
  } catch (error) {
    console.error('获取后台仪表板失败:', error);
    return NextResponse.json({ error: '获取后台仪表板失败' }, { status: 500 });
  }
});
