import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { signOutUser } from "@/firebase/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AuthModal } from "./AuthModal";
import { LogIn, LogOut, Bell, Mail, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  subscribeUserNotifications,
  markNotificationAsRead,
  markProjectNotificationsAsRead,
  getOrCreateRecipientCopy,
} from "@/firebase/projectService";
import { useProject } from "@/context/ProjectContext";
import type { Notification } from "@/types/sharing";

function formatRelativeDate(ms: number): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function AuthWidget() {
  const { user, loading } = useAuth();
  const {
    isDirty,
    deserializeProject,
    setCurrentProject,
    currentProjectId,
  } = useProject();

  const [modalOpen, setModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }
    const unsubscribe = subscribeUserNotifications(user.uid, (data) => {
      setNotifications(data);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const handleLogout = async () => {
    try {
      await signOutUser();
      toast.success("Signed out", {
        description: "You have signed out successfully.",
      });
    } catch (err) {
      console.error("Sign out error:", err);
      toast.error("Sign out failed", {
        description: "Failed to sign out. Please try again.",
      });
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    // 1. Mark as read
    try {
      if (!notif.read) {
        await markNotificationAsRead(notif.id);
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }

    // 2. Guard against dirty state
    if (isDirty) {
      const ok = window.confirm(
        "You have unsaved changes. Opening another project will discard them. Continue?"
      );
      if (!ok) return;
    }

    if (!user?.uid) return;

    console.log("[Verification Log] Recipient opening shared project from notification. Original project ID:", notif.projectId);
    setLoadingProjectId(notif.projectId);
    setPopoverOpen(false);

    try {
      // Always open the shared project as a personal copy so the owner's
      // document is never overwritten by the recipient's edits.
      const { metadata: copyMeta, payload, copyId } =
        await getOrCreateRecipientCopy(notif.projectId, user.uid);

      console.log("[Verification Log] Shared project loaded from notification. currentProjectId set to copy ID:", copyId);

      if (copyId === currentProjectId) return;

      deserializeProject(payload);
      setCurrentProject(copyId, copyMeta.name, copyMeta.description || "");

      // Mark all notifications for the original (owner's) project as read
      await markProjectNotificationsAsRead(user.uid, notif.projectId);

      toast.success("Project loaded", { description: copyMeta.name });
    } catch (err: any) {
      console.error("Failed to load project from notification:", err);
      toast.error("Failed to open project", {
        description: err.message || "An error occurred.",
      });
    } finally {
      setLoadingProjectId(null);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.uid) return;
    try {
      const unread = notifications.filter((n) => !n.read);
      await Promise.all(unread.map((n) => markNotificationAsRead(n.id)));
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      toast.error("Failed to update notifications");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="h-9 w-9 rounded-full bg-muted/60 animate-pulse border border-border/50 shrink-0" />
    );
  }

  return (
    <>
      {user ? (
        <div className="flex items-center gap-2">
          {/* Notifications Popover */}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-full border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 rounded-xl border border-border bg-card shadow-xl overflow-hidden" align="end">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-muted/20">
                <span className="text-sm font-bold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[320px] overflow-y-auto divide-y divide-border/50">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground p-4">
                    <Mail className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-semibold">No notifications</p>
                    <p className="text-xs text-muted-foreground/70">When projects are shared with you, they will appear here.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/40 flex items-start gap-3 relative ${
                        !notif.read ? "bg-primary/5" : ""
                      }`}
                      disabled={loadingProjectId !== null}
                    >
                      {!notif.read && (
                        <span className="absolute top-4 left-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                      <div className="flex-1 min-w-0 pl-1">
                        <p className="text-xs font-semibold text-foreground leading-normal">
                          <span className="font-bold text-primary">{notif.sharedBy}</span> shared project{" "}
                          <span className="font-bold">"{notif.projectName}"</span> with you.
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                          {loadingProjectId === notif.projectId ? (
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          ) : (
                            formatRelativeDate(notif.createdAt)
                          )}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none shrink-0 overflow-hidden">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs uppercase">
                    {(user.displayName || user.email || "U").substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none text-foreground">
                    {user.displayName || "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground truncate mt-0.5">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Button
          onClick={() => setModalOpen(true)}
          variant="outline"
          size="sm"
          className="h-9 px-3 gap-1.5 text-xs font-semibold shrink-0"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign In
        </Button>
      )}

      <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
