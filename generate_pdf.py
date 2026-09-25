import math
from fpdf import FPDF

def main():
    pdf = FPDF()
    pdf.add_page()
    
    # Title
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 6, "PROFIT & LOSS FROM SELF EMPLOYED", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 6, "TAX YEAR ________", new_x="LMARGIN", new_y="NEXT", align="C")
    
    pdf.ln(4)
    
    # Bullet points
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(5, 5, "-", align="R")
    pdf.cell(0, 5, "YOU MUST BRING THIS COMPLETED FORM TO YOUR APPOINTMENT", new_x="LMARGIN", new_y="NEXT")
    
    pdf.cell(5, 5, "-", align="R")
    pdf.cell(0, 5, "DO NOT MAIL THIS FORM SEPARATELY FROM YOUR TAX INFORMATION", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(6)
    
    # Basic Info
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 6, "Business Name: ___________________________________________________________________", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "Fed ID # (If Applicable): _________________________________", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "Principal Activity/Service: ___________________________________________________________", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(4)
    
    # Income
    pdf.set_font("helvetica", "BU", 10)
    w_inc = pdf.get_string_width("Income")
    pdf.cell(w_inc, 6, "Income")
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 6, " (Write in whole dollar amounts)", new_x="LMARGIN", new_y="NEXT")
    
    pdf.cell(0, 6, "Gross Receipts or Sales: $___________________________", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(4)
    
    # Cost of Goods Sold
    pdf.set_font("helvetica", "BU", 10)
    pdf.cell(0, 6, "Cost of Goods Sold", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 6, "Purchase of Materials: $___________________ Labor/Subcontractor Cost $ ___________________", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(4)
    
    # 1099 Questions
    text1 = "Did you make any payments in ________ that would require you to file form(s) 1099?   YES "
    w1 = pdf.get_string_width(text1)
    pdf.cell(w1, 6, text1)
    pdf.rect(pdf.get_x(), pdf.get_y() + 1, 4, 4)
    pdf.set_x(pdf.get_x() + 8)
    text2 = "NO "
    w2 = pdf.get_string_width(text2)
    pdf.cell(w2, 6, text2)
    pdf.rect(pdf.get_x(), pdf.get_y() + 1, 4, 4)
    pdf.ln(6)
    
    text3 = "If Yes, did you or will you file required forms 1099?   YES "
    w3 = pdf.get_string_width(text3)
    pdf.cell(w3, 6, text3)
    pdf.rect(pdf.get_x(), pdf.get_y() + 1, 4, 4)
    pdf.set_x(pdf.get_x() + 8)
    pdf.cell(w2, 6, text2)
    pdf.rect(pdf.get_x(), pdf.get_y() + 1, 4, 4)
    pdf.ln(8)
    
    # Expenses
    pdf.set_font("helvetica", "BU", 10)
    w_exp = pdf.get_string_width("Expenses")
    pdf.cell(w_exp, 6, "Expenses")
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 6, " (Write in whole dollar amounts)", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    
    # Two columns for expenses
    col1_x = 10
    col2_x = 105
    
    # Row 1
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Advertising ________________________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "Pension and Profit-sharing plans ______________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 2
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Auto/Truck Expenses ________________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "Rent or lease:", new_x="LMARGIN", new_y="NEXT")
    
    # Row 3
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Commissions and fees _______________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "  a) Vehicles/machinery/equip. ______________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 4
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Contract labor _____________________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "  b) Other bus. property ____________________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 5
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Equip/Auto Purchases _______________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "Repairs and maintenance ____________________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 6
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Employee benefit programs __________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "Supplies __________________________________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 7
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Insurance _________________________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "Taxes and licenses __________________________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 8
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Interest ___________________________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "Travel and meals:", new_x="LMARGIN", new_y="NEXT")
    
    # Row 9
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Mortgage (paid to banks, etc.) ________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "  a) Travel _______________________________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 10
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Legal and Professional services ________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "  b) Meals _______________________________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 11
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "Office expense _____________________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "Utilities ___________________________________", new_x="LMARGIN", new_y="NEXT")
    
    # Row 12
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "Wages ____________________________________", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(4)
    
    # Other Expenses
    pdf.cell(0, 6, "Other Expenses (Please list):", new_x="LMARGIN", new_y="NEXT")
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "__________________________________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "__________________________________________", new_x="LMARGIN", new_y="NEXT")
    pdf.set_xy(col1_x, pdf.get_y())
    pdf.cell(90, 6, "__________________________________________")
    pdf.set_xy(col2_x, pdf.get_y())
    pdf.cell(90, 6, "__________________________________________", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(8)
    
    # Disclaimer
    pdf.set_font("helvetica", "B", 9)
    pdf.multi_cell(0, 5, "I understand that if requested by the IRS and/or local State Taxing Authority, I have receipts and adequate documents to support the items listed above and will make them available in the event of an audit.")
    
    pdf.ln(8)
    
    # Signature line
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(85, 6, "________________________________________", align="L")
    pdf.cell(35, 6, "______________", align="L")
    pdf.cell(0, 6, "__________________________________", new_x="LMARGIN", new_y="NEXT", align="L")
    
    pdf.set_font("helvetica", "B", 8)
    pdf.cell(85, 4, "Client Name", align="L")
    pdf.cell(35, 4, "Date", align="L")
    pdf.cell(0, 4, "Signature", new_x="LMARGIN", new_y="NEXT", align="L")
    
    pdf.output("Profit_and_Loss_Form.pdf")

if __name__ == "__main__":
    main()
