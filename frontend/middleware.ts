/**
 * Middleware for deep link redirects
 * 处理旧URL到新URL格式的重定向
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /tasks/123 -> /?view=tasks&drawer=task-123
  const taskMatch = pathname.match(/^\/tasks\/(\d+)$/);
  if (taskMatch) {
    const url = new URL('/', request.url);
    url.searchParams.set('view', 'tasks');
    url.searchParams.set('drawer', `task-${taskMatch[1]}`);
    return NextResponse.redirect(url);
  }

  // /plans/456 -> /?view=tasks&drawer=plan-456 (合并到工作视图)
  const planMatch = pathname.match(/^\/plans\/(\d+)$/);
  if (planMatch) {
    const url = new URL('/', request.url);
    url.searchParams.set('view', 'tasks');
    url.searchParams.set('drawer', `plan-${planMatch[1]}`);
    return NextResponse.redirect(url);
  }

  // /tasks -> /?view=tasks
  if (pathname === '/tasks') {
    const url = new URL('/', request.url);
    url.searchParams.set('view', 'tasks');
    return NextResponse.redirect(url);
  }

  // /plans -> /?view=tasks (合并到工作视图)
  if (pathname === '/plans') {
    const url = new URL('/', request.url);
    url.searchParams.set('view', 'tasks');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/tasks/:path*', '/plans/:path*'],
};
