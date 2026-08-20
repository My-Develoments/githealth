import { useCallback, useState } from "react";

export function useAsyncActionState() {
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(async (action: (() => void | Promise<void>) | undefined) => {
    if (!action || isPending) {
      return;
    }

    setIsPending(true);
    try {
      await action();
    } finally {
      setIsPending(false);
    }
  }, [isPending]);

  return {
    isPending,
    run
  };
}
