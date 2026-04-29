import { PIPELINE_STAGES } from "@/lib/pipelineConstants";

const AdminPipelineEdit = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Edição do Painel</h1>
        <p className="text-sm text-muted-foreground">
          Visualize as etapas atuais do pipeline comercial.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Etapas</p>
        <ol className="space-y-1 text-sm">
          {PIPELINE_STAGES.map((s, i) => (
            <li key={s.value} className="flex gap-2">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default AdminPipelineEdit;
