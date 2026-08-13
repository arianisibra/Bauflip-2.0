/**
 * Erkennung veralteter Browser-Tabs nach einem Deploy.
 *
 * Next bringt mit `deploymentId` bereits einen Schutz mit, der aber erst bei
 * einer Navigation greift. Der Fall, der in der Praxis wehtut, ist ein anderer:
 * Jemand hat das Fenster seit gestern offen, klickt auf «Speichern» — und die
 * Server-Action-ID aus dem alten Build kennt der Server nicht mehr. Die Aktion
 * läuft nie an (die Daten bleiben also unversehrt), aber der Knopf wirkt tot.
 *
 * Dieses Modul hält fest, ob der eigene Build noch dem des Servers entspricht.
 * Bewusst ohne React, damit auch der QueryProvider bei einem Mutationsfehler
 * eine Prüfung anstossen kann.
 */

const OWN_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_DEPLOYMENT_ID;

let stale = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function subscribeStaleDeployment(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getStaleDeploymentSnapshot(): boolean {
  return stale;
}

/** Beim Serverrendern gibt es nie einen Versatz — der Build ist ja gerade der aktuelle. */
export function getStaleDeploymentServerSnapshot(): boolean {
  return false;
}

/**
 * Fragt die Deployment-Kennung des Servers ab und vergleicht sie mit der eigenen.
 * Einmal als veraltet erkannt, bleibt es dabei: Neuer wird der geladene Tab nicht.
 */
export async function checkDeploymentVersion(): Promise<void> {
  if (stale || !OWN_DEPLOYMENT_ID) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch("/api/version", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { deploymentId?: string | null };
      if (data.deploymentId && data.deploymentId !== OWN_DEPLOYMENT_ID) {
        stale = true;
        for (const listener of listeners) listener();
      }
    } catch {
      // Netzwerkfehler bedeutet nicht «veraltet» — der Monteur ist vielleicht
      // nur kurz im Funkloch. Dann lieber nichts anzeigen.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
