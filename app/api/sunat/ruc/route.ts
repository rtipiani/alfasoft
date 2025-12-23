import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const ruc = searchParams.get('ruc');

    if (!ruc || ruc.length !== 11) {
        return NextResponse.json(
            { success: false, error: 'RUC inválido' },
            { status: 400 }
        );
    }

    try {
        const token = process.env.SUNAT_API_TOKEN;
        console.log("Checking RUC:", ruc, "Token exists:", !!token);

        if (!token) {
            console.error("Missing SUNAT_API_TOKEN");
            return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
        }

        const response = await fetch(`https://apiperu.dev/api/ruc/${ruc}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Upstream API Error:", response.status, errorText);
            return NextResponse.json(
                { success: false, error: `Error proveedor: ${response.status} ${response.statusText}`, details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching RUC:', error);
        return NextResponse.json(
            { success: false, error: `Error interno: ${error.message}` },
            { status: 500 }
        );
    }
}
