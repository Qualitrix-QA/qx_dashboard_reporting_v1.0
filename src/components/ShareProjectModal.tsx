import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Loader2, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getUserByEmail,
  shareProjectWithUser,
  generateShareLink,
  validateEmail,
} from "@/firebase/projectService";

interface ShareProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function ShareProjectModal({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ShareProjectModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const resetForm = useCallback(() => {
    setEmail("");
    setShareLink(null);
    setNotRegistered(false);
    setError(null);
    setLinkCopied(false);
  }, []);

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleShareWithUser = async () => {
    if (!user) return;

    const trimmedEmail = email.trim();
    setError(null);

    // Validation
    if (!trimmedEmail) {
      setError("Please enter an email address.");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Invalid email format.");
      return;
    }

    if (trimmedEmail.toLowerCase() === user.email?.toLowerCase()) {
      setError("Cannot share a project with yourself.");
      return;
    }

    setIsLoading(true);
    try {
      // Look up user by email in Firestore users collection.
      // A record only exists if the recipient has previously signed into this app.
      const recipient = await getUserByEmail(trimmedEmail);

      if (!recipient) {
        // Recipient hasn't signed up yet — auto-generate a share link
        // and surface a clear message so the owner knows what to do.
        const linkId = await generateShareLink(projectId, trimmedEmail);
        const shareUrl = `${window.location.origin}/shared/${linkId}`;
        setShareLink(shareUrl);
        setNotRegistered(true);
        setIsLoading(false);
        return;
      }

      // Recipient is already registered — share directly and send a notification.
      await shareProjectWithUser(
        projectId,
        recipient.uid,
        recipient.email,
        user.email || "",
        projectName,
        user.uid
      );

      toast.success("Project shared!", {
        description: `${trimmedEmail} can now access this project.`,
      });

      handleClose();
    } catch (err) {
      const e = err as Error;
      console.error("Share failed:", e);
      const msg = e.message || "Failed to share project.";
      setError(msg);
      toast.error("Share failed", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    const trimmedEmail = email.trim();
    setError(null);

    // Validation
    if (!trimmedEmail) {
      setError("Please enter an email address.");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Invalid email format.");
      return;
    }

    setIsLoading(true);
    try {
      const linkId = await generateShareLink(projectId, trimmedEmail);
      const shareUrl = `${window.location.origin}/shared/${linkId}`;
      setShareLink(shareUrl);
      toast.success("Share link created!", {
        description: "Copy and send the link to share this project.",
      });
    } catch (err) {
      const e = err as Error;
      console.error("Link generation failed:", e);
      const msg = e.message || "Failed to generate share link.";
      setError(msg);
      toast.error("Link generation failed", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Send className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              Share Project
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Share "{projectName}" with a colleague or generate a link for others to access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Email Input */}
          <div className="space-y-1.5">
            <Label
              htmlFor="share-email"
              className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
            >
              Email Address
            </Label>
            <Input
              id="share-email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className="h-10 text-sm focus-visible:ring-primary"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive animate-fade-in">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleShareWithUser}
              disabled={isLoading || !email.trim()}
              className="flex-1 gap-1.5 font-bold shadow-md"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Share
            </Button>
            <Button
              onClick={handleGenerateLink}
              disabled={isLoading || !email.trim()}
              variant="outline"
              className="flex-1 gap-1.5 font-semibold"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>Link</>
              )}
              Generate Link
            </Button>
          </div>

          {/* Not-registered info banner + generated link */}
          {notRegistered && shareLink && (
            <div className="space-y-3 animate-fade-in">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-amber-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </span>
                <div>
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">User isn't registered</p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    <span className="font-semibold">{email}</span> hasn't signed up yet. A share link has been generated — copy it and send it to them. They'll be prompted to create an account before accessing the project.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Share Link
                </Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    className="flex h-9 flex-1 rounded-md border border-input bg-background/50 px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {linkCopied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Share Link Display (for manually generated links where user IS registered) */}
          {shareLink && !notRegistered && (
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Share Link
              </Label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex h-9 flex-1 rounded-md border border-input bg-background/50 px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {linkCopied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground/80">
                Share this link with {email || "the recipient"} to grant access.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
