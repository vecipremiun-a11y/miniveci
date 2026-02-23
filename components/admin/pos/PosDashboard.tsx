"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosConnectionCard } from "./PosConnectionCard";
import { PosSyncCard } from "./PosSyncCard";
import { PosLogsCard } from "./PosLogsCard";

export function PosDashboard() {
    return (
        <Tabs defaultValue="connection" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px] bg-slate-100">
                <TabsTrigger value="connection">Conexión</TabsTrigger>
                <TabsTrigger value="sync">Sincronización</TabsTrigger>
                <TabsTrigger value="logs">Logs & Hooks</TabsTrigger>
                <TabsTrigger value="conflicts">Conflictos (0)</TabsTrigger>
            </TabsList>

            <TabsContent value="connection" className="space-y-4">
                <PosConnectionCard />
            </TabsContent>

            <TabsContent value="sync" className="space-y-4">
                <PosSyncCard />
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
                <PosLogsCard />
            </TabsContent>

            <TabsContent value="conflicts" className="space-y-4">
                <div className="bg-white p-8 rounded-lg border border-dashed text-center flex flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">No hay productos con conflicto actualmente. El POS y la configuración manual coinciden o la sincronización los ha resuelto.</p>
                </div>
            </TabsContent>
        </Tabs>
    );
}
