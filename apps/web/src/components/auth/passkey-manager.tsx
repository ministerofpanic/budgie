"use client";

import { useCallback, useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";
import { renamePasskey, revokePasskey } from "@/lib/passkeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasskeyRow = { readonly id: string; readonly name?: string | undefined };

const PasskeyListItem = ({
  passkey,
  pending,
  disableRevoke,
  onRename,
  onRevoke,
}: {
  readonly passkey: PasskeyRow;
  readonly pending: boolean;
  readonly disableRevoke: boolean;
  readonly onRename: (id: string, name: string) => void;
  readonly onRevoke: (id: string) => void;
}) => {
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      const name = event.target.value.trim();
      if (name && name !== passkey.name) onRename(passkey.id, name);
    },
    [passkey.id, passkey.name, onRename],
  );

  const handleRevokeClick = useCallback(() => {
    onRevoke(passkey.id);
  }, [passkey.id, onRevoke]);

  return (
    <li className="flex items-center gap-2">
      <Input
        defaultValue={passkey.name ?? "Unnamed passkey"}
        onBlur={handleBlur}
        disabled={pending}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pending || disableRevoke}
        onClick={handleRevokeClick}
      >
        Revoke
      </Button>
    </li>
  );
};

const PasskeyManager = ({ initialPasskeys }: { readonly initialPasskeys: PasskeyRow[] }) => {
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const { data } = await authClient.passkey.listUserPasskeys();
    if (data) setPasskeys(data);
  }, []);

  const handleAddPasskey = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const { error: addError } = await authClient.passkey.addPasskey();
      if (addError) {
        setError(addError.message ?? "Could not add a passkey.");
        return;
      }
      await refresh();
    });
  }, [refresh]);

  const handleRename = useCallback(
    (id: string, name: string) => {
      setError(null);
      startTransition(async () => {
        await renamePasskey(id, name);
        await refresh();
      });
    },
    [refresh],
  );

  const handleRevoke = useCallback(
    (id: string) => {
      setError(null);
      startTransition(async () => {
        const result = await revokePasskey(id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await refresh();
      });
    },
    [refresh],
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <ul className="flex flex-col gap-3">
        {passkeys.map((passkey) => (
          <PasskeyListItem
            key={passkey.id}
            passkey={passkey}
            pending={pending}
            disableRevoke={passkeys.length <= 1}
            onRename={handleRename}
            onRevoke={handleRevoke}
          />
        ))}
      </ul>
      <Button type="button" onClick={handleAddPasskey} loading={pending}>
        Add another passkey
      </Button>
    </div>
  );
};

export { PasskeyManager };
