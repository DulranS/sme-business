"use client";

import { useState } from "react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useRequireRole } from "@/lib/roleGuard";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import type { NotificationType, NotificationPriority } from "@/lib/types";
import { Badge, Card, EmptyState, PageHeader, Stat, Table } from "@/components/ui";

const PRIORITY_LABEL: Record<NotificationPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PRIORITY_TONE: Record<NotificationPriority, "default" | "amber" | "bad"> = {
  low: "default",
  medium: "amber",
  high: "bad",
};

const TYPE_LABEL: Record<NotificationType, string> = {
  receivable_overdue: "Overdue payment from customer",
  receivable_due_soon: "Customer payment due soon",
  payable_overdue: "Overdue payment to supplier",
  payable_due_soon: "Supplier payment due soon",
  low_stock: "Low stock warning",
  expense_due: "Expense due",
  loan_payment_due: "Loan payment due",
  project_over_budget: "Project budget alert",
  milestone_due: "Milestone payment due",
  custom: "Custom reminder",
};

export default function NotificationsPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { notifications, markNotificationRead, deleteNotification, notificationsLoading: loading } = useNotifications();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (guardLoading || !allowed) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const highPriorityCount = notifications.filter((n) => n.priority === "high" && !n.isRead).length;

  return (
    <>
      <PageHeader title="Notifications & Reminders" />

      <div className="flex gap-2 mb-5 border-b border-line">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            filter === "all" ? "border-amber-soft text-fg font-medium" : "border-transparent text-muted"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            filter === "unread" ? "border-amber-soft text-fg font-medium" : "border-transparent text-muted"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Total notifications" value={notifications.length.toString()} />
        <Stat label="Unread" value={unreadCount.toString()} tone={unreadCount > 0 ? "amber" : "default"} />
        <Stat label="High priority" value={highPriorityCount.toString()} tone={highPriorityCount > 0 ? "bad" : "default"} />
      </div>

      {!loading && filteredNotifications.length === 0 && (
        <EmptyState
          title={filter === "unread" ? "No unread notifications" : "No notifications"}
          body={
            filter === "unread"
              ? "You're all caught up! New notifications will appear here when there are overdue payments, low stock warnings, or other reminders."
              : "Notifications will appear here when there are overdue payments, low stock warnings, expense due dates, or other reminders you need to act on."
          }
        />
      )}

      {filteredNotifications.length > 0 && (
        <Card>
          <div className="table-container">
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">Priority</th>
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium">Title</th>
                  <th className="py-2 px-3 font-medium">Due date</th>
                  <th className="py-2 pl-3 font-medium text-right">·</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredNotifications].sort((a, b) => b.createdAt - a.createdAt).map((notification) => (
                  <tr
                    key={notification.id}
                    className={`border-b border-line last:border-0 ${!notification.isRead ? "bg-panel2/50" : ""}`}
                  >
                    <td className="py-2.5 pr-3">
                      <Badge tone={PRIORITY_TONE[notification.priority]}>
                        {PRIORITY_LABEL[notification.priority]}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted text-xs">{TYPE_LABEL[notification.type]}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium">{notification.title}</div>
                      <div className="text-[11px] text-muted mt-0.5">{notification.message}</div>
                    </td>
                    <td className="py-2.5 px-3 text-muted text-xs">{notification.dueDate ?? "—"}</td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      {!notification.isRead && (
                        <button
                          onClick={() =>
                            markNotificationRead(notification.id).catch((err) =>
                              toast.error("Couldn't mark as read", toastableErrorMessage(err))
                            )
                          }
                          className="text-xs text-amber-soft hover:underline mr-3"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() =>
                          deleteNotification(notification.id).catch((err) =>
                            toast.error("Couldn't dismiss", toastableErrorMessage(err))
                          )
                        }
                        className="text-xs text-muted hover:text-bad"
                      >
                        Dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="text-[11px] text-muted mt-3">
            Notifications are generated automatically based on your business data — overdue payments, low stock items, upcoming expenses, and loan payment schedules. Custom reminders can be added from the relevant pages.
          </div>
        </Card>
      )}
    </>
  );
}
