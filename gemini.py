from google import genai

client = genai.Client()

interaction = client.interactions.create(
    model="gemini-3.8-flash",
    input="Based on image recognition and heartrate metrics," + \
        "give recommendations for what exercises a person should do next"
)
print(interaction.output_text)