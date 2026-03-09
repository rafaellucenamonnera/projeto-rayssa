import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Clock, TrendingUp, Users, Loader2, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Button } from "@/components/ui/button";

interface DashboardData {
  valor_pago: number;
  valor_pendente: number;
  previsao_futura: number;
  clientes_ativos: number;
}

interface ConsultorData {
  parceiro_id: string;
  consultor: string;
  clientes_ativos: number;
  valor_pago: number;
  valor_pendente: number;
  previsao_futura: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
};

const MESES = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => {
  const year = currentYear - 2 + i;
  return { value: String(year), label: String(year) };
});

export default function AdminFinanceiro() {
  const [selectedConsultor, setSelectedConsultor] = useState<string>("all");
  const [selectedMes, setSelectedMes] = useState<string>("all");
  const [selectedAno, setSelectedAno] = useState<string>("all");

  const rpcParams = {
    p_mes: selectedMes !== "all" ? Number(selectedMes) : null,
    p_ano: selectedAno !== "all" ? Number(selectedAno) : null,
  };

  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ["financeiro_dashboard", selectedMes, selectedAno],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financeiro_dashboard", rpcParams);
      if (error) throw error;
      return data as unknown as DashboardData;
    },
  });

  const { data: consultoresData, isLoading: isLoadingConsultores } = useQuery({
    queryKey: ["financeiro_consultores", selectedMes, selectedAno],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financeiro_consultores", rpcParams);
      if (error) throw error;
      return data as unknown as ConsultorData[];
    },
  });

  if (isLoadingDashboard || isLoadingConsultores) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredConsultores = consultoresData?.filter(
    (c) => selectedConsultor === "all" || c.parceiro_id === selectedConsultor
  ) || [];

  const chartData = [...filteredConsultores]
    .sort((a, b) => b.valor_pago - a.valor_pago)
    .slice(0, 10);

  const displayDashboardData = selectedConsultor !== "all" 
    ? {
        valor_pago: filteredConsultores[0]?.valor_pago || 0,
        valor_pendente: filteredConsultores[0]?.valor_pendente || 0,
        previsao_futura: filteredConsultores[0]?.previsao_futura || 0,
        clientes_ativos: filteredConsultores[0]?.clientes_ativos || 0,
      }
    : dashboardData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-display font-bold">Dashboard Financeiro</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-[180px]">
            <Select value={selectedMes} onValueChange={setSelectedMes}>
              <SelectTrigger>
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Meses</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[140px]">
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Anos</SelectItem>
                {ANOS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[250px]">
            <Select value={selectedConsultor} onValueChange={setSelectedConsultor}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Consultores</SelectItem>
                {consultoresData?.map((c) => (
                  <SelectItem key={c.parceiro_id} value={c.parceiro_id}>
                    {c.consultor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Valor Pago</p>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <div className="text-2xl font-bold font-display">{formatCurrency(displayDashboardData?.valor_pago || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Valor Pendente</p>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <div className="text-2xl font-bold font-display">{formatCurrency(displayDashboardData?.valor_pendente || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Previsão Futura</p>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <div className="text-2xl font-bold font-display">{formatCurrency(displayDashboardData?.previsao_futura || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Clientes Gerando Comissão</p>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold font-display">{displayDashboardData?.clientes_ativos || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Comissões por Consultor (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível para o gráfico.
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="consultor" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), "Valor Pago"]}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                  />
                  <Bar dataKey="valor_pago" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary))`}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Previsão por Consultor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead className="text-center">Clientes Ativos</TableHead>
                <TableHead className="text-right">Valor Pago</TableHead>
                <TableHead className="text-right">Valor Pendente</TableHead>
                <TableHead className="text-right">Previsão Futura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConsultores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum consultor encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredConsultores.map((c) => (
                  <TableRow key={c.parceiro_id}>
                    <TableCell className="font-medium">{c.consultor}</TableCell>
                    <TableCell className="text-center">{c.clientes_ativos}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">{formatCurrency(c.valor_pago)}</TableCell>
                    <TableCell className="text-right text-amber-600">{formatCurrency(c.valor_pendente)}</TableCell>
                    <TableCell className="text-right text-blue-600">{formatCurrency(c.previsao_futura)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
