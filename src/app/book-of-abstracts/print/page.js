import PrintableBookOfAbstracts from '../../components/PrintableBookOfAbstracts';

export const metadata = {
    title: 'Print Book of Abstracts',
};

export default function PrintBookOfAbstractsPage() {
    return (
        <div className="bg-white min-h-screen">
            <PrintableBookOfAbstracts />
        </div>
    );
}
