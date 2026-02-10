"use client";

import React, { useState } from 'react';
import { ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ContactFormProps {
    pageSlug: string;
}

export function ContactForm({ pageSlug }: ContactFormProps) {
    const [company, setCompany] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('メールアドレスを入力してください');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/form-submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageSlug,
                    formTitle: 'お問い合わせ',
                    formFields: [
                        { fieldName: 'company', fieldLabel: '会社名', value: company },
                        { fieldName: 'name', fieldLabel: 'お名前', value: name },
                        { fieldName: 'email', fieldLabel: 'メールアドレス', value: email },
                        { fieldName: 'message', fieldLabel: 'メッセージ', value: message },
                    ].filter((f) => f.value.trim() !== ''),
                }),
            });

            const data = await res.json();
            if (data.success) {
                setIsSubmitted(true);
                toast.success('送信完了しました');
            } else {
                toast.error(data.error || '送信に失敗しました');
            }
        } catch {
            toast.error('送信に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <section id="contact" className="px-6 md:px-12 py-32 bg-[#f8f8f8] border-t border-black/5 scroll-mt-16">
                <div className="max-w-[1400px] mx-auto flex flex-col items-center justify-center text-center py-16">
                    <CheckCircle className="w-12 h-12 text-green-600 mb-4" />
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 font-manrope">送信完了</h2>
                    <p className="text-gray-500 font-jp">
                        お問い合わせいただきありがとうございます。<br />
                        内容を確認の上、ご連絡いたします。
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section id="contact" className="px-6 md:px-12 py-32 bg-[#f8f8f8] border-t border-black/5 scroll-mt-16">
            <div className="max-w-[1400px] mx-auto grid md:grid-cols-2 gap-16">
                <div>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 font-manrope">Contact</h2>
                    <p className="text-gray-500 font-jp leading-relaxed">
                        プロジェクトのご相談、サービスに関するご質問など、<br />
                        お気軽にご連絡ください。
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">
                    <div className="group">
                        <label className="block text-xs font-mono text-gray-400 mb-2 uppercase tracking-widest group-focus-within:text-black transition-colors">Company Name</label>
                        <input
                            type="text"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="w-full bg-transparent border-b border-gray-200 py-3 text-lg font-jp focus:outline-none focus:border-black transition-colors rounded-none placeholder:text-gray-200"
                            placeholder="株式会社オタスケ LP"
                        />
                    </div>
                    <div className="group">
                        <label className="block text-xs font-mono text-gray-400 mb-2 uppercase tracking-widest group-focus-within:text-black transition-colors">Your Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-transparent border-b border-gray-200 py-3 text-lg font-jp focus:outline-none focus:border-black transition-colors rounded-none placeholder:text-gray-200"
                            placeholder="山田 太郎"
                        />
                    </div>
                    <div className="group">
                        <label className="block text-xs font-mono text-gray-400 mb-2 uppercase tracking-widest group-focus-within:text-black transition-colors">Email Address <span className="text-red-400">*</span></label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-transparent border-b border-gray-200 py-3 text-lg font-jp focus:outline-none focus:border-black transition-colors rounded-none placeholder:text-gray-200"
                            placeholder="hello@example.com"
                        />
                    </div>
                    <div className="group">
                        <label className="block text-xs font-mono text-gray-400 mb-2 uppercase tracking-widest group-focus-within:text-black transition-colors">Message</label>
                        <textarea
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full bg-transparent border-b border-gray-200 py-3 text-lg font-jp focus:outline-none focus:border-black transition-colors rounded-none resize-none placeholder:text-gray-200"
                            placeholder="ご用件をご記入ください"
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="group inline-flex items-center text-lg font-bold border-b-2 border-black pb-1 hover:text-gray-600 hover:border-gray-600 transition-colors mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                送信中...
                                <Loader2 className="ml-3 w-5 h-5 animate-spin" />
                            </>
                        ) : (
                            <>
                                Send Message
                                <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-2 transition-transform" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </section>
    );
}
