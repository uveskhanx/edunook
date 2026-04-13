import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Plus, Trash2, Check, ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/test/$testId')({
  component: TestDetailPage,
});

type Question = {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  position: number;
};

function TestDetailPage() {
  const { testId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [testData, setTestData] = useState<{ title: string; description: string | null; creator_id: string } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Taking test
  const [taking, setTaking] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  // Adding question
  const [addingQ, setAddingQ] = useState(false);
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState(0);
  const [savingQ, setSavingQ] = useState(false);

  useEffect(() => { loadTest(); }, [testId]);

  async function loadTest() {
    const [testRes, qRes] = await Promise.all([
      supabase.from('tests').select('title, description, creator_id').eq('id', testId).single(),
      supabase.from('questions').select('*').eq('test_id', testId).order('position'),
    ]);
    if (testRes.data) setTestData(testRes.data);
    setQuestions((qRes.data as unknown as Question[]) || []);
    setLoading(false);
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    setSavingQ(true);
    await supabase.from('questions').insert({
      test_id: testId,
      question: qText,
      options: qOptions.filter(o => o.trim()),
      correct_answer: qCorrect,
      position: questions.length,
    });
    setQText('');
    setQOptions(['', '', '', '']);
    setQCorrect(0);
    setAddingQ(false);
    setSavingQ(false);
    loadTest();
  }

  async function deleteQuestion(id: string) {
    await supabase.from('questions').delete().eq('id', id);
    setQuestions(questions.filter(q => q.id !== id));
  }

  function submitTest() {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) correct++;
    });
    setScore(correct);
    setSubmitted(true);

    if (user) {
      supabase.from('test_attempts').insert({
        user_id: user.id,
        test_id: testId,
        score: correct,
        total_questions: questions.length,
        answers: Object.entries(answers).map(([qId, ans]) => ({ question_id: qId, answer: ans })),
      });
    }
  }

  if (loading) return <Layout><LoadingSpinner className="py-20" /></Layout>;
  if (!testData) return <Layout><div className="text-center py-20 text-muted-foreground">Test not found</div></Layout>;

  const isCreator = user?.id === testData.creator_id;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link to="/tests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tests
        </Link>

        <h1 className="text-2xl font-bold text-foreground">{testData.title}</h1>
        {testData.description && <p className="text-muted-foreground mt-1">{testData.description}</p>}

        {/* Questions */}
        <div className="mt-6 space-y-4">
          {questions.length === 0 && !isCreator && (
            <p className="text-muted-foreground text-center py-8">No questions in this test yet</p>
          )}

          {submitted ? (
            <div className="text-center p-6 bg-card border border-border rounded-xl animate-scale-in">
              <div className="text-4xl font-bold text-primary mb-2">{score}/{questions.length}</div>
              <p className="text-muted-foreground">
                {score === questions.length ? 'Perfect score! 🎉' : score > questions.length / 2 ? 'Good job! 👍' : 'Keep learning! 📚'}
              </p>
              <button onClick={() => { setTaking(false); setSubmitted(false); setAnswers({}); }}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all">
                Try Again
              </button>
            </div>
          ) : taking ? (
            <>
              {questions.map((q, qi) => (
                <div key={q.id} className="p-4 bg-card border border-border rounded-xl animate-fade-in">
                  <p className="font-medium text-card-foreground mb-3">{qi + 1}. {q.question}</p>
                  <div className="space-y-2">
                    {(q.options as string[]).map((opt, oi) => (
                      <label key={oi} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${answers[q.id] === oi ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}>
                        <input type="radio" name={q.id} checked={answers[q.id] === oi}
                          onChange={() => setAnswers({ ...answers, [q.id]: oi })}
                          className="accent-primary" />
                        <span className="text-sm text-card-foreground">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={submitTest} disabled={Object.keys(answers).length < questions.length}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all">
                Submit Answers
              </button>
            </>
          ) : (
            <>
              {questions.map((q, qi) => (
                <div key={q.id} className="p-4 bg-card border border-border rounded-xl flex items-start justify-between">
                  <div>
                    <p className="font-medium text-card-foreground">{qi + 1}. {q.question}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(q.options as string[]).map((opt, oi) => (
                        <span key={oi} className={`text-xs px-2 py-0.5 rounded ${oi === q.correct_answer && isCreator ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>{opt}</span>
                      ))}
                    </div>
                  </div>
                  {isCreator && (
                    <button onClick={() => deleteQuestion(q.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                {questions.length > 0 && (
                  <button onClick={() => setTaking(true)}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all">
                    Take Test
                  </button>
                )}
                {isCreator && (
                  <button onClick={() => setAddingQ(!addingQ)}
                    className="flex items-center gap-1 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:opacity-80 transition-all">
                    <Plus className="w-4 h-4" /> Add Question
                  </button>
                )}
              </div>
            </>
          )}

          {addingQ && isCreator && (
            <form onSubmit={addQuestion} className="p-4 bg-card border border-border rounded-xl space-y-3 animate-slide-up">
              <input type="text" value={qText} onChange={e => setQText(e.target.value)} required placeholder="Question"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              {qOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={qCorrect === i} onChange={() => setQCorrect(i)} className="accent-primary" />
                  <input type="text" value={opt} onChange={e => { const o = [...qOptions]; o[i] = e.target.value; setQOptions(o); }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 px-3 py-1.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Select the radio button next to the correct answer</p>
              <button type="submit" disabled={savingQ}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all">
                {savingQ ? 'Saving...' : 'Add Question'}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
