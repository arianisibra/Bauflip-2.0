import { WerkstattListe } from "@/components/app/werkstatt-liste";

export default function TechWerkstattPage() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Werkstatt</h1>
        <p className="text-sm text-muted-foreground">
          Aufträge in der Werkstatt. Nach der Reparatur «Werkstatt fertig» tippen — der Auftrag geht auf
          «Montagebereit».
        </p>
      </div>
      <WerkstattListe />
    </div>
  );
}
