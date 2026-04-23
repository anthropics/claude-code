/**
 * Dev-only visual smoke test for shadcn/ui core components.
 *
 * **F-11 で page.tsx → page.dev.tsx にリネーム**。
 * next.config.mjs の pageExtensions が development ビルドの時だけ `dev.tsx`
 * を含めるよう設定されているため、production build ではこのファイル自体が
 * Next.js の page discovery 対象外になり、bundle にも含まれない。
 *
 * 参考: https://nextjs.org/docs/app/api-reference/next-config-js/pageExtensions
 *
 * ランタイムでの `notFound()` 分岐はもう不要だが、多層防御として残す。
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { notFound } from "next/navigation";

export default function ComponentsDemo() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl space-y-16 px-4 py-12 sm:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Components Demo</h1>
        <p className="text-muted-foreground">
          Dev-only preview. Swap the design tokens in
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-sm">client/src/styles/tokens.css</code>
          and reload to verify every component still looks intentional.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-4">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Typography tokens">
        <div className="space-y-2">
          <p className="text-hero font-bold">Hero headline</p>
          <p className="text-3xl font-semibold">3xl heading</p>
          <p className="text-2xl font-semibold">2xl heading</p>
          <p className="text-xl">xl heading</p>
          <p className="text-lg">lg heading</p>
          <p className="text-base">
            Base paragraph (<code className="rounded bg-muted px-1 py-0.5">--text-base</code>) reads
            at 16–17px with fluid scaling up to 1440px.
          </p>
          <p className="text-sm">Small paragraph (meta / helper text).</p>
          <p className="text-xs text-muted-foreground">
            xs is reserved for timestamps and captions (never body).
          </p>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="handle">@handle</Label>
            <Input id="handle" placeholder="your-handle" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">自己紹介</Label>
            <Textarea id="bio" placeholder="300 字まで。Markdown 一部対応。" />
          </div>
        </div>
      </Section>

      <Section title="Avatar + Badge">
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarImage src="https://github.com/haruna0712.png" alt="haruna" />
            <AvatarFallback>HA</AvatarFallback>
          </Avatar>
          <Badge>python</Badge>
          <Badge variant="secondary">nextjs</Badge>
          <Badge variant="outline">claude-code</Badge>
          <Badge variant="destructive">deprecated</Badge>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="following" className="w-full">
          <TabsList>
            <TabsTrigger value="following">フォロー中</TabsTrigger>
            <TabsTrigger value="home">ホーム</TabsTrigger>
            <TabsTrigger value="trending">トレンド</TabsTrigger>
          </TabsList>
          <TabsContent value="following" className="pt-4 text-sm text-muted-foreground">
            フォロー中タブの中身。TL はフォロー中 70% + 全体上位 30% のアルゴリズム配信。
          </TabsContent>
          <TabsContent value="home" className="pt-4 text-sm text-muted-foreground">
            ホームタブの中身。
          </TabsContent>
          <TabsContent value="trending" className="pt-4 text-sm text-muted-foreground">
            トレンドタブの中身。24h のタグ上位 10 件をサイドバーに連動表示。
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Card">
        <Card>
          <CardHeader>
            <CardTitle>@haruna</CardTitle>
            <CardDescription>Engineer SNS のドッグフーディング中</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            Fluid typography と shadow-card の確認用ダミー。
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              プロフィールへ
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Dialog を開く</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ツイートを削除しますか？</DialogTitle>
              <DialogDescription>
                この操作は取り消せません。削除すると元ツイートへのリプライには「削除済みツイートです」と表示されます。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">キャンセル</Button>
              </DialogClose>
              <Button variant="destructive">削除する</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title="DropdownMenu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">メニュー</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>アカウント</DropdownMenuLabel>
            <DropdownMenuItem>プロフィールを編集</DropdownMenuItem>
            <DropdownMenuItem>通知設定</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">ログアウト</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>
    </main>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
