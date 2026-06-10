import { useEffect, useState } from "react";
import { getNotificationPermission } from "@/lib/notifications";

/**
 * Hook to check and monitor notification permission status
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isGranted, setIsGranted] = useState(false);

  useEffect(() => {
    const checkPermission = () => {
      const perm = getNotificationPermission();
      setPermission(perm);
      setIsGranted(perm === "granted");
    };

    checkPermission();

    // Listen for permission changes (if browser supports it)
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "notifications" }).then((result) => {
        result.addEventListener("change", checkPermission);
        return () => result.removeEventListener("change", checkPermission);
      });
    }
  }, []);

  return { permission, isGranted };
}
