## Objetivo
Ajustar apenas a primeira dobra de `/teste-monnera` conforme correções do usuário, preservando visual, formulário, scoring e integrações.

## Arquivo alterado
- `src/pages/TesteMonnera.tsx` (único arquivo)

## Mudanças

1. **Import**
   - Garantir que `ArrowRight` esteja importado de `lucide-react`, sem duplicar.

2. **Handler único `openDiagnosticForm`**
   ```tsx
   const openDiagnosticForm = () => {
     setShowForm(true);
     window.setTimeout(() => {
       document
         .getElementById("teste-monnera-form")
         ?.scrollIntoView({ behavior: "smooth", block: "start" });
     }, 0);
   };
   ```
   - Ambos os CTAs usam `openDiagnosticForm`. Não manter `scrollToForm`.

3. **Estado `showForm` e efeitos**
   - Usar `state.currentStep` e `state.submitted` (não `step`/`RESULT_STEP`):
   ```tsx
   const [showForm, setShowForm] = useState(() => state.currentStep > 0 || state.submitted);

   useEffect(() => {
     if (state.currentStep > 0 || state.submitted) {
       setShowForm(true);
     }
   }, [state.currentStep, state.submitted]);
   ```
   - No handler `resetTest` (nome em inglês, conforme arquivo local), continuar chamando `setShowForm(false)`.

4. **Identificação da primeira dobra**
   - Substituir:
   ```tsx
   <p className="text-sm font-medium text-primary">Teste Monnera</p>
   <p className="text-xs text-muted-foreground">Diagnóstico educativo</p>
   ```
   Por:
   ```tsx
   <p className="text-sm font-medium text-primary">Diagnóstico educativo Monnera</p>
   ```
   - Preservar a classe da logo:
   ```tsx
   <img src={logoMonnera} alt="Monnera" className="h-10 w-10 rounded-lg sm:h-12 sm:w-12 sm:rounded-xl" />
   ```

5. **Wrapper responsivo do topo + CTA no topo**
   ```tsx
   <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div className="flex items-center gap-3">
       <img src={logoMonnera} alt="Monnera" className="h-10 w-10 rounded-lg sm:h-12 sm:w-12 sm:rounded-xl" />
       <p className="text-sm font-medium text-primary">Diagnóstico educativo Monnera</p>
     </div>
     <Button className="h-10 w-full text-sm sm:w-auto" onClick={openDiagnosticForm}>
       Fazer diagnóstico gratuito
       <ArrowRight className="ml-2 h-4 w-4" />
     </Button>
   </div>
   ```

6. **CTA atual do corpo do hero**
   ```tsx
   <Button className="h-11 text-sm sm:h-12 sm:text-base" onClick={openDiagnosticForm}>
     Fazer diagnóstico gratuito
     <ArrowRight className="ml-2 h-4 w-4" />
   </Button>
   ```

7. **Microcopy LGPD**
   - Substituir o texto do `<p>` com `ShieldCheck` por:
   > Resultado educativo. Não substitui validação jurídica ou contábil. Ao continuar, você concorda com o uso dos dados informados para contato comercial da Monnera, conforme a LGPD.
   - Preservar ícone, classes e posição.

8. **Seção inline do formulário**
   ```tsx
   {showForm && (
     <section id="teste-monnera-form" className="container mx-auto px-4 py-8 md:py-12">
       {/* conteúdo atual do formulário sem alterações */}
     </section>
   )}
   ```

## Preservações
- Não alterar questionário, `submit_teste_monnera`, `localStorage`, resultado, card lateral "O diagnóstico avalia", validações e mensagens, rota, tokens de tema, cores, botões, cards, ícones ou componentes shadcn/Tailwind existentes.

## Validação
- `npm run build`.
- Verificação visual do hero (desktop + mobile) confirmando dois CTAs e ausência do formulário no carregamento inicial.