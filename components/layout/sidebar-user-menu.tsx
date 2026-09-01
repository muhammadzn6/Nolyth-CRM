"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, Chip } from "@heroui/react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { formatRole } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { AppActor } from "@/types/auth";

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function SidebarUserMenu({
  user,
  collapsed,
}: {
  user: AppActor;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative pt-3">
      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-default",
          collapsed ? "justify-center" : "",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar size="sm" className="bg-accent text-accent-foreground">
          <Avatar.Fallback>{getInitials(user.name)}</Avatar.Fallback>
        </Avatar>
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {user.name}
            </span>
            <span className="block truncate text-xs text-muted">{formatRole(user.role)}</span>
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={cn(
              "absolute bottom-full z-50 mb-2 w-64 rounded-2xl bg-overlay p-3 shadow-overlay",
              collapsed ? "left-0" : "left-0 right-0",
            )}
            role="menu"
          >
            <div className="mb-3 flex items-center gap-3">
              <Avatar size="md" className="bg-accent text-accent-foreground">
                <Avatar.Fallback>{getInitials(user.name)}</Avatar.Fallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>
            <Chip size="sm" variant="soft" color="accent" className="mb-3">
              {formatRole(user.role)}
            </Chip>
            <Button
              variant="ghost"
              fullWidth
              isDisabled={isPending}
              onPress={() => {
                startTransition(async () => {
                  await signOut({ callbackUrl: "/login" });
                });
              }}
              className="justify-start text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {isPending ? "Signing out..." : "Sign out"}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
