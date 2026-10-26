import Link from "next/link"
import { notFound } from "next/navigation"

import { EspaceNav } from "@/components/espace/espace-nav"
import {
  ConversationReportForm,
  ConversationSafetyBanner,
} from "@/components/espace/conversation-safety"
import {
  ConversationReplyForm,
  InquiryFollowUpForm,
  InquiryNoteForm,
  InquiryStageForm,
} from "@/components/espace/inquiry-follow-forms"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePublisherPage } from "@/lib/auth-session"
import {
  formatCiDateTime,
  PRIORITY_LABELS,
  STAGE_LABELS,
  SYSTEM_MESSAGE_LABELS,
  VISIT_STATUS_LABELS,
} from "@/lib/crm-labels"
import { getNestInquiry, listConversationMessages } from "@/lib/nest-inquiries"

export default async function DemandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePublisherPage("/espace/demandes")
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  let inquiry
  try {
    inquiry = await getNestInquiry(id)
  } catch {
    notFound()
  }

  const messages = inquiry.conversationId
    ? await listConversationMessages(inquiry.conversationId)
    : []
  const safetyMessages = [
    ...new Map(
      messages
        .flatMap((item) => item.safetyHints ?? [])
        .filter(
          (hint) => hint.severity === "HIGH" || hint.severity === "MEDIUM",
        )
        .map((hint) => [hint.userMessage, hint]),
    ).values(),
  ]

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <EspaceNav current="/espace/demandes" />
      <div>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/espace/demandes" />}
          className="-ml-2 mb-2"
        >
          ← Demandes
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {inquiry.prospect.displayName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {inquiry.listing.title} ·{" "}
          {STAGE_LABELS[inquiry.stage] ?? inquiry.stage} ·{" "}
          {PRIORITY_LABELS[inquiry.priority]}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Besoin et priorité</CardTitle>
          <CardDescription>{inquiry.suggestedAction}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            Demande du {formatCiDateTime(inquiry.createdAt)}
            {inquiry.firstRespondedAt
              ? ` · première réponse le ${formatCiDateTime(inquiry.firstRespondedAt)}`
              : " · pas encore de réponse"}
          </p>
          {inquiry.message ? <p>{inquiry.message}</p> : null}
          {inquiry.budgetAmount != null ? (
            <p>
              Budget déclaré : {inquiry.budgetAmount.toLocaleString("fr-CI")}{" "}
              FCFA
            </p>
          ) : null}
          {inquiry.desiredZone ? <p>Zone : {inquiry.desiredZone}</p> : null}
          {inquiry.desiredMoveAt ? (
            <p>Délai souhaité : {formatCiDateTime(inquiry.desiredMoveAt)}</p>
          ) : null}
          <ul className="list-disc pl-5 text-muted-foreground">
            {inquiry.priorityReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/annonces/${inquiry.listing.id}`} />}
            className="w-fit"
          >
            Voir l’annonce
          </Button>
        </CardContent>
      </Card>

      {inquiry.conversationId ? (
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>
              Messages visibles du prospect. Les notes internes n’y apparaissent
              jamais.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ConversationSafetyBanner messages={safetyMessages} />
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun message pour le moment.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {messages.map((item) => (
                  <li
                    key={item.id}
                    className={
                      item.mine
                        ? "rounded-lg bg-muted px-3 py-2 text-sm"
                        : "rounded-lg border border-border px-3 py-2 text-sm"
                    }
                  >
                    <p className="text-xs text-muted-foreground">
                      {item.mine
                        ? "Vous"
                        : (item.author?.displayName ?? "Prospect")}{" "}
                      · {formatCiDateTime(item.createdAt)}
                    </p>
                    <p className="mt-1">
                      {item.systemCode
                        ? (SYSTEM_MESSAGE_LABELS[item.systemCode] ??
                          item.systemCode)
                        : (item.body ?? "")}
                    </p>
                    {item.safetyHints && item.safetyHints.length > 0 ? (
                      <p className="mt-1 text-xs text-amber-800">
                        {item.safetyHints[0]?.userMessage}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            <ConversationReplyForm
              conversationId={inquiry.conversationId}
              inquiryId={inquiry.id}
            />
            <ConversationReportForm
              conversationId={inquiry.conversationId}
              inquiryId={inquiry.id}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Visites liées</CardTitle>
        </CardHeader>
        <CardContent>
          {inquiry.appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune visite demandée pour cette annonce.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {inquiry.appointments.map((visit) => (
                <li key={visit.id}>
                  {VISIT_STATUS_LABELS[visit.status] ?? visit.status} ·{" "}
                  {formatCiDateTime(visit.scheduledAt)}
                </li>
              ))}
            </ul>
          )}
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/espace/visites" />}
          >
            Gérer les visites
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suivi commercial</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          <InquiryStageForm inquiryId={inquiry.id} stage={inquiry.stage} />
          <InquiryFollowUpForm
            inquiryId={inquiry.id}
            nextAction={inquiry.nextAction}
            nextActionAt={inquiry.nextActionAt}
            budgetAmount={inquiry.budgetAmount}
            desiredZone={inquiry.desiredZone}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes internes</CardTitle>
          <CardDescription>
            Jamais envoyées au prospect, même par erreur de copie.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {inquiry.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune note.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {inquiry.notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <p className="text-xs text-muted-foreground">
                    {note.author.displayName} ·{" "}
                    {formatCiDateTime(note.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
          <InquiryNoteForm inquiryId={inquiry.id} />
        </CardContent>
      </Card>

      {inquiry.stageHistory.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Historique des statuts</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm">
              {inquiry.stageHistory.map((item, index) => (
                <li key={`${item.createdAt}-${index}`}>
                  {item.fromStage
                    ? `${STAGE_LABELS[item.fromStage] ?? item.fromStage} → `
                    : ""}
                  {STAGE_LABELS[item.toStage] ?? item.toStage}
                  {item.reason ? ` (${item.reason})` : ""} ·{" "}
                  {item.author.displayName} · {formatCiDateTime(item.createdAt)}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </main>
  )
}
