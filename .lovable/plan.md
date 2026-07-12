## Objetivo
Ajustar somente o comportamento da primeira dobra da landing `/teste-monnera` para que o formulário fique oculto no carregamento inicial e seja revelado apenas ao clicar no CTA **"Fazer diagnóstico gratuito"**.

## Escopo
- Alterar apenas `src/pages/TesteMonnera.tsx`.
- Não criar arquivos novos.
- Não alterar `src/App.tsx`.
- Não alterar perguntas, scoring, resultado, localStorage, RPC, Supabase, painel comercial, tarefas ou notificações.
- Manter o layout visual atual da primeira dobra.

## Implementação

1. Adicionar estado local para controlar a visibilidade do formulário:
   ```tsx
   const [showForm, setShowForm] = useState(() => state.currentStep > 0 || state.submitted);
   ```

2. Adicionar efeito para preservar progresso salvo:
   ```tsx
   useEffect(() => {
     if (state.currentStep > 0 || state.submitted) {
       setShowForm(true);
     }
   }, [state.currentStep, state.submitted]);
   ```

3. Alterar o CTA **"Fazer diagnóstico gratuito"** para revelar o formulário e rolar até ele:
   ```tsx
   onClick={() => {
     setShowForm(true);
     window.setTimeout(() => {
       document
         .getElementById("teste-monnera-form")
         ?.scrollIntoView({ behavior: "smooth", block: "start" });
     }, 0);
   }}
   ```

4. Renderizar a seção do formulário condicionalmente, preservando o id e as classes existentes:
   ```tsx
   {showForm && (
     <section id="teste-monnera-form" className="container mx-auto px-4 py-8 md:py-12">
       {/* manter aqui o conteúdo atual do formulário sem alterações */}
     </section>
   )}
   ```

5. No fluxo de reset/reinício do teste, adicionar:
   ```tsx
   setShowForm(false);
   ```

## Critérios de Aceite
- `/teste-monnera` abre apenas com a primeira dobra/hero.
- A segunda dobra/formulário não aparece antes do clique no CTA.
- O CTA revela o formulário e rola suavemente até ele.
- Progresso salvo continua funcionando.
- Reset oculta novamente o formulário.
- `npm run build` passa.

## Validação
- Executar `npm run build`.
- Verificar visualmente desktop e mobile que o formulário só aparece após o clique no CTA.