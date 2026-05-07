import { Suspense } from 'react';
import { Metadata } from 'next';
import CourseClientWrapper from './course-client-wrapper';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';

type CourseRecord = {
  title?: string;
  description?: string;
  price?: number;
  thumbnailUrl?: string | null;
};

async function fetchCourseBySlug(slug: string, dbUrl?: string | null) {
  if (!dbUrl) {
    return null;
  }

  const slugMapRes = await fetch(`${dbUrl}/course_slugs/${slug}.json`, { next: { revalidate: 3600 } });
  if (!slugMapRes.ok) {
    return null;
  }

  const courseId = await slugMapRes.json();
  if (!courseId) {
    return null;
  }

  const courseRes = await fetch(`${dbUrl}/courses/${courseId}.json`, { next: { revalidate: 3600 } });
  if (!courseRes.ok) {
    return null;
  }

  const course = await courseRes.json();
  if (!course) {
    return null;
  }

  return { courseId, course: course as CourseRecord };
}

export async function generateMetadata(
  props: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const params = await props.params;
  const slug = params.slug;
  const siteUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://edunook.com';
  const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  const record = await fetchCourseBySlug(slug, dbUrl);
  if (!record) {
    return { title: 'Course | EduNook' };
  }

  const { course } = record;
  const title = `${course.title || 'Course'} | EduNook`;
  const description = course.description?.substring(0, 160) || 'Learn on EduNook';
  const images = course.thumbnailUrl
    ? [{ url: optimizeCloudinaryUrl(course.thumbnailUrl, 1200), width: 1200, height: 630 }]
    : [];

  return {
    title,
    description,
    alternates: {
      canonical: `/course/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${siteUrl}/course/${slug}`,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  };
}

export default async function CourseViewPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const siteUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://edunook.com';

  let courseJsonLd = null;

  try {
    const record = await fetchCourseBySlug(params.slug, dbUrl);
    if (record) {
      const reviewRes = await fetch(`${dbUrl}/course_reviews/${record.courseId}.json`, { next: { revalidate: 3600 } });
      const reviews = reviewRes.ok ? await reviewRes.json() : null;
      const reviewCount = reviews ? Object.keys(reviews).length : 0;

      courseJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: record.course.title,
        description: record.course.description,
        url: `${siteUrl}/course/${params.slug}`,
        image: record.course.thumbnailUrl ? [optimizeCloudinaryUrl(record.course.thumbnailUrl, 1200)] : undefined,
        provider: {
          '@type': 'Organization',
          name: 'EduNook',
          sameAs: siteUrl,
        },
        offers: {
          '@type': 'Offer',
          category: (record.course.price || 0) > 0 ? 'Paid' : 'Free',
          price: record.course.price || 0,
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
        },
        ...(reviewCount > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '5',
                reviewCount: String(reviewCount),
                bestRating: '5',
                worstRating: '1',
              },
            }
          : {}),
      };
    }
  } catch {
    courseJsonLd = null;
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      {courseJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
        />
      )}
      <CourseClientWrapper slug={params.slug} />
    </Suspense>
  );
}
