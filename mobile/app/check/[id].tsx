import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, View } from 'react-native';
import {
  DISCLAIMER_CANNOT_RULE_OUT,
  NOSAS_CITATION,
  NOSAS_SCREENING_NOT_DIAGNOSIS,
  NOSAS_URLS,
  RED_FLAG_NOTE,
  RED_FLAG_QUESTION,
  SNORE_NOT_APNEA_LINE,
  SYMPTOM_NOT_VALIDATED,
  SYMPTOM_RULE_NOTE,
} from '@core/content/claims';
import { FREQUENCY_LABELS, SYMPTOM_ITEMS } from '@core/questionnaire/symptomChecklist';
import { useRealNights } from '../../src/data/nightSource';
import { buildChecks, type CheckId } from '../../src/state/checks';
import { overviewSummary } from '../../src/state/evidence';
import { useSettings } from '../../src/state/settings';
import { AppText } from '../../src/ui/AppText';
import { Chip } from '../../src/ui/Chip';
import { EvidenceCard } from '../../src/ui/EvidenceCard';
import { GlassCard } from '../../src/ui/GlassCard';
import { IconTile } from '../../src/ui/IconTile';
import { InsetGroup, ListRow } from '../../src/ui/InsetGroup';
import { PrimaryButton } from '../../src/ui/PrimaryButton';
import { SampleRow } from '../../src/ui/SampleRow';
import { Screen, Stagger } from '../../src/ui/Screen';
import { BackBar } from '../../src/ui/ScreenHeader';
import { SectionHeader } from '../../src/ui/Section';
import { Surface } from '../../src/ui/Surface';

export default function CheckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = useSettings();
  const { nights } = useRealNights();
  const checks = useMemo(() => buildChecks(overviewSummary(s, nights).items, s, nights), [s, nights]);
  const c = checks.find((x) => x.id === (id as CheckId));
  if (!c) {
    return (
      <Screen top={<BackBar title="Check" />}>
        <AppText variant="body" tone="secondary">
          This check could not be found.
        </AppText>
      </Screen>
    );
  }
  const urls: readonly string[] = NOSAS_URLS;
  const retake = () => router.push('/questionnaire?from=checks');
  return (
    <Screen top={<BackBar title={c.title} />} testID={`check-detail-${c.id}`} gap={22}>
      <Stagger i={0}>
        <GlassCard radius={30} padding={22}>
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <IconTile name={c.icon} size={64} />
              <View style={{ flex: 1, gap: 8 }}>
                <AppText variant="title2" style={{ letterSpacing: -0.3 }}>
                  {c.title}
                </AppText>
                <Chip label={c.status} tone={c.tone} icon="info.circle" />
              </View>
            </View>
            <AppText variant="subheadline" tone="secondary">
              {c.kind}. Not a diagnosis.
            </AppText>
          </View>
        </GlassCard>
      </Stagger>

      <Stagger i={1} style={{ gap: 10 }}>
        <SectionHeader title="What it shows" />
        {c.item ? <EvidenceCard item={c.item} /> : null}
        {!c.item && c.id === 'warning' ? (
          <Surface radius="xl" padding={18}>
            <View style={{ gap: 6 }}>
              <AppText variant="headline">{RED_FLAG_QUESTION}</AppText>
              <AppText variant="body">{s.redFlag === null ? 'Not answered yet.' : s.redFlag ? 'You answered yes.' : 'You answered no.'}</AppText>
            </View>
          </Surface>
        ) : null}
        {c.id === 'symptoms' && Object.keys(s.symptoms).length > 0 ? (
          <InsetGroup header="Your answers">
            {SYMPTOM_ITEMS.map((it) => (
              <ListRow key={it.key} title={it.text} value={s.symptoms[it.key] ? FREQUENCY_LABELS[s.symptoms[it.key] as keyof typeof FREQUENCY_LABELS] : 'Not answered'} />
            ))}
          </InsetGroup>
        ) : null}
      </Stagger>

      <Stagger i={2} style={{ gap: 10 }}>
        <SectionHeader title="Sources" />
        {c.id === 'nosas' ? (
          <InsetGroup footer={NOSAS_CITATION}>
            {urls.map((u) => (
              <ListRow key={u} title={u} leading="link" accessibilityRole="link" onPress={() => void Linking.openURL(u)} />
            ))}
          </InsetGroup>
        ) : null}
        {c.id === 'snore' ? (
          <InsetGroup>
            <ListRow title="Model card" subtitle="Intended use, tests and known limits" trailing="chevron" leading="doc.text" onPress={() => router.push('/model-card')} />
          </InsetGroup>
        ) : null}
        {c.id === 'symptoms' ? (
          <Surface radius="xl" padding={18}>
            <AppText variant="subheadline">{SYMPTOM_NOT_VALIDATED}</AppText>
          </Surface>
        ) : null}
        <InsetGroup>
          <ListRow title="All sources" trailing="chevron" leading="link" onPress={() => router.push('/sources')} />
        </InsetGroup>
      </Stagger>

      <Stagger i={3} style={{ gap: 10 }}>
        <SectionHeader title="Limits" />
        <Surface radius="xl" padding={18} tone="info" level="L3">
          <View style={{ gap: 8 }}>
            <AppText variant="subheadline">{DISCLAIMER_CANNOT_RULE_OUT}</AppText>
            {c.id === 'snore' ? <AppText variant="subheadline">{SNORE_NOT_APNEA_LINE}</AppText> : null}
            {c.id === 'nosas' ? <AppText variant="subheadline">{NOSAS_SCREENING_NOT_DIAGNOSIS}</AppText> : null}
            {c.id === 'symptoms' ? <AppText variant="subheadline">{SYMPTOM_RULE_NOTE}</AppText> : null}
            {c.id === 'warning' ? <AppText variant="subheadline">{RED_FLAG_NOTE}</AppText> : null}
          </View>
        </Surface>
      </Stagger>

      <Stagger i={4} style={{ gap: 10 }}>
        {c.id === 'snore' ? (
          <>
            {nights[0] ? <PrimaryButton label="View latest night" onPress={() => router.push(`/night/${nights[0]?.id}`)} /> : <SampleRow onPress={() => router.push('/night/sample')} />}
          </>
        ) : c.id === 'warning' ? (
          <PrimaryButton label="Next steps" onPress={() => router.push('/next-steps')} />
        ) : (
          <PrimaryButton label={c.status === 'Not done yet' ? 'Answer now' : 'Retake the questionnaire'} onPress={retake} />
        )}
      </Stagger>
    </Screen>
  );
}
