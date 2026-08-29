"use client";

import { useEffect, useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";
import { renamePasskey, revokePasskey } from "@/lib/passkeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasskeyRow = { readonly id: string; readonly name?: string | undefined };

const PasskeyManager = ({ initialPasskeys }: { readonly initialPasskeys: PasskeyRow[] }) => {
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = async () => {
    const { data } = await authClient.passkey.listUserPasskeys();
    if (data) setPasskeys(data);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleAddPasskey = () => {
    setError(null);
    startTransition(async () => {
      const { error: addError } = await authClient.passkey.addPasskey();
      if (addError) {
        setError(addError.message ?? "Could not add a passkey.");
        return;
      }
      await refresh();
    });
  };

  const handleRename = (id: string, name: string) => {
    setError(null);
    startTransition(async () => {
      await renamePasskey(id, name);
      await refresh();
    });
  };

  const handleRevoke = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await revokePasskey(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <ul className="flex flex-col gap-3">
        {passkeys.map((passkey) => (
          <li key={passkey.id} className="flex items-center gap-2">
            <Input
              defaultValue={passkey.name ?? "Unnamed passkey"}
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name && name !== passkey.name) handleRename(passkey.id, name);
              }}
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || passkeys.length <= 1}
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onClick={() => handleRevoke(passkey.id)}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={handleAddPasskey} disabled={pending}>
        Add another passkey
      </Button>
    </div>
  );
};

export { PasskeyManager };
