import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('news', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  return rss({
    title: 'Kinglet — News',
    description: 'Release notes, tutorials, and other news from the Kinglet project.',
    site: context.site,
    items: posts.map(post => ({
      title: post.data.title,
      description: post.data.description ?? '',
      pubDate: post.data.pubDate,
      link: `/news/${post.id}/`,
    })),
  });
}
