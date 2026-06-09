import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Boxes,
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Avatar, Button, Empty, Skeleton } from "./components/ui";
import { useAuth } from "./features/auth/auth-provider";
import { api } from "./lib/api";
import { keys } from "./lib/query-keys";
import type { Notification } from "./lib/types";
import { initials } from "./lib/utils";

const notificationString = (
  data: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = data?.[key];
  return typeof value === "string" ? value : undefined;
};

function NotificationsCenter() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data: unread } = useQuery({
    queryKey: keys.unreadNotifications,
    queryFn: api.unreadNotifications,
    refetchInterval: 30_000,
  });
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: keys.notifications(unreadOnly),
    enabled: open,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.notifications({ page: pageParam, limit: 10, unreadOnly }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: keys.notifications(unreadOnly) });
    client.invalidateQueries({ queryKey: keys.unreadNotifications });
  };
  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeNotification(id),
    onSuccess: refresh,
  });
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  useEffect(() => {
    if (!open || !hasNextPage || !loadMoreRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, open]);
  const notifications = data?.pages.flatMap((page) => page.data) ?? [];
  const openNotification = (notification: Notification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    const workspaceId = notificationString(notification.data, "workspaceId");
    const projectId = notificationString(notification.data, "projectId");
    if (workspaceId && projectId) {
      navigate(`/workspaces/${workspaceId}/projects/${projectId}`);
      setOpen(false);
      return;
    }
    if (workspaceId) {
      navigate(`/workspaces/${workspaceId}`);
      setOpen(false);
    }
  };
  return (
    <div className="notifications-center" ref={panelRef}>
      <button
        type="button"
        className={open ? "notifications-trigger active" : "notifications-trigger"}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="notifications-icon">
          <Bell size={15} />
          {!!unread?.count && <span>{unread.count}</span>}
        </span>
        <div>
          <strong>Notifications</strong>
          <small>
            {unread?.count ? `${unread.count} unread` : "You're all caught up"}
          </small>
        </div>
      </button>
      {open && (
        <div className="notifications-panel">
          <header>
            <div>
              <strong>Notifications</strong>
              <small>
                {unread?.count ? `${unread.count} unread` : "No unread items"}
              </small>
            </div>
            <Button
              variant="ghost"
              disabled={readAll.isPending || !unread?.count}
              onClick={() => readAll.mutate()}
            >
              Read all
            </Button>
          </header>
          <label className="notifications-filter">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
            />
            Unread only
          </label>
          <div className="notifications-list">
            {isLoading ? (
              <Skeleton rows={3} />
            ) : notifications.length ? (
              notifications.map((notification) => (
                <article
                  className={
                    notification.readAt
                      ? "notification-item"
                      : "notification-item unread"
                  }
                  key={notification.id}
                >
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                  >
                    <span />
                    <div>
                      <strong>{notification.title}</strong>
                      {notification.message && <p>{notification.message}</p>}
                      <small>
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </small>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete notification"
                    onClick={() => remove.mutate(notification.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              ))
            ) : (
              <Empty
                title="No notifications"
                detail="New task updates will appear here."
              />
            )}
            <div className="notifications-load-more" ref={loadMoreRef}>
              {isFetchingNextPage
                ? "Loading more notifications..."
                : hasNextPage
                  ? "Scroll to load more"
                  : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { data } = useQuery({
    queryKey: keys.workspaces,
    queryFn: api.workspaces,
  });
  const avatarUrl = user ? api.avatarUrl(user.id) : undefined;
  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <header>
          <Link className="brand" to="/">
            <span>TF</span>
            <strong>TaskFlow</strong>
          </Link>
          <Button
            variant="ghost"
            className="mobile-only"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </Button>
        </header>
        <nav>
          <small>Workspace</small>
          <NavLink to="/" end>
            <Boxes size={16} /> All workspaces
          </NavLink>
          {data?.data?.slice(0, 5).map((workspace) => (
            <NavLink to={`/workspaces/${workspace.id}`} key={workspace.id}>
              <span className="nav-dot">{workspace.name[0]}</span>
              {workspace.name}
            </NavLink>
          ))}
        </nav>
        <NotificationsCenter />
        <footer>
          <Link to="/profile">
            <Avatar label={initials(user ?? undefined)} src={avatarUrl} />
            <span>
              <strong>{user?.firstName || user?.email}</strong>
              <small>Account settings</small>
            </span>
            <ChevronDown size={14} />
          </Link>
          <Button variant="ghost" onClick={() => logout()}>
            <LogOut size={15} /> Sign out
          </Button>
        </footer>
      </aside>
      <main className="main">
        <div className="mobile-topbar">
          <Button variant="ghost" onClick={() => setOpen(true)}>
            <Menu size={19} />
          </Button>
          <strong>TaskFlow</strong>
          <Link to="/profile">
            <Settings size={17} />
          </Link>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
