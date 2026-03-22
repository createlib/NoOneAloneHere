'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, ArrowLeft } from 'lucide-react';

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            await fetch(form.action, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });
            // no-cors implies we won't know if it actually succeeded, but we assume it did.
            setSubmitted(true);
        } catch (error) {
            console.error('Form submission failed:', error);
            // Optionally handle error here
        }
    };

    return (
        <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-texture">
            <div className="max-w-2xl mx-auto pt-16">
                <div className="mb-6">
                    <Link href="/" className="inline-flex items-center text-sm text-brand-500 hover:text-brand-800 transition-colors duration-200 font-bold tracking-widest">
                        <ArrowLeft className="h-4 w-4 mr-1" /> トップページに戻る
                    </Link>
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-brand-900 sm:text-4xl font-serif">お問い合わせ</h1>
                    <p className="mt-4 text-sm text-brand-600 leading-relaxed">
                        ご質問やご相談は、以下のフォームよりお気軽にお問い合わせください。<br />
                        内容を確認次第、担当者よりご連絡いたします。
                    </p>
                </div>

                <div className="bg-[#fffdf9] shadow-md sm:rounded-sm border border-brand-200 p-6 sm:p-8">
                    {submitted ? (
                        <div className="text-center py-10 animate-fade-in-up">
                            <CheckCircle className="mx-auto h-12 w-12 text-[#10B981] mb-4" />
                            <h3 className="text-xl font-bold text-brand-900 font-serif tracking-widest">送信完了</h3>
                            <p className="mt-2 text-brand-500 text-sm">お問い合わせありがとうございます。<br />内容を確認の上、ご連絡させていただきます。</p>
                            <button onClick={() => setSubmitted(false)} className="mt-6 text-sm text-brand-600 hover:text-brand-800 underline font-bold tracking-widest">
                                フォームに戻る
                            </button>
                        </div>
                    ) : (
                        <form action="https://docs.google.com/forms/d/e/1FAIpQLSe-um1-IG2s0ZChRZl4MAWjhbTWSjzGPINVL9VQjReflwK4Zw/formResponse" method="POST" onSubmit={handleSubmit}>
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-bold text-brand-700 tracking-widest">
                                        氏名 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1">
                                        <input type="text" name="entry.1284985487" id="name" required
                                            className="appearance-none block w-full px-3 py-2 border border-brand-200 rounded-sm shadow-sm placeholder-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 sm:text-sm bg-white"
                                            placeholder="山田 太郎" />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-sm font-bold text-brand-700 tracking-widest">
                                        メールアドレス <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1">
                                        <input type="email" name="entry.1213234869" id="email" required
                                            className="appearance-none block w-full px-3 py-2 border border-brand-200 rounded-sm shadow-sm placeholder-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 sm:text-sm bg-white"
                                            placeholder="example@email.com" />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="subject" className="block text-sm font-bold text-brand-700 tracking-widest">
                                        件名 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1">
                                        <input type="text" name="entry.549170446" id="subject" required
                                            className="appearance-none block w-full px-3 py-2 border border-brand-200 rounded-sm shadow-sm placeholder-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 sm:text-sm bg-white"
                                            placeholder="サービスに関するお問い合わせ" />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="message" className="block text-sm font-bold text-brand-700 tracking-widest">
                                        お問い合わせ内容 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1">
                                        <textarea id="message" name="entry.1104805669" rows={6} required
                                            className="appearance-none block w-full px-3 py-2 border border-brand-200 rounded-sm shadow-sm placeholder-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 sm:text-sm bg-white"
                                            placeholder="お問い合わせ内容をご記入ください。"></textarea>
                                    </div>
                                </div>

                                <div>
                                    <button type="submit"
                                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-bold tracking-widest text-[#fffdf9] bg-brand-800 hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition duration-150 ease-in-out">
                                        送信する
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                <div className="mt-8 text-center text-sm text-brand-400 font-mono tracking-widest">
                    &copy; NOAH. All rights reserved.
                </div>
            </div>
        </div>
    );
}
