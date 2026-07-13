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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const resetForm = useCallback(() => {
    setEmail("");
    setShareLink(null);
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
      // Look up user by email
      const recipient = await getUserByEmail(trimmedEmail);

      if (!recipient) {
        setError("User not found. Try generating a share link instead.");
        setIsLoading(false);
        return;
      }

      // Share project with registered user
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

          {/* Share Link Display */}
          {shareLink && (
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
                  {linkCopied ? "Copied" : "Copy"}
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
